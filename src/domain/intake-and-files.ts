import { FileAttachment, IntakeSubmission } from './types';
import crypto from 'crypto';
import { QA_CHECKLIST_ITEMS, QaChecklistKey } from './qa-checklist';

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
];

export const FORBIDDEN_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.msi',
  '.js',
  '.html',
  '.htm',
  '.php',
  '.py',
  '.vbs',
];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Largest acceptable request body before it is buffered: multipart carries raw bytes (+ framing), while the
 * JSON path carries base64 (4/3 of the bytes) plus field overhead.
 */
export function maxUploadRequestBytes(contentType: string): number {
  const overhead = 1024 * 1024;
  return contentType.includes('multipart/form-data')
    ? MAX_FILE_SIZE_BYTES + overhead
    : Math.ceil((MAX_FILE_SIZE_BYTES * 4) / 3) + overhead;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export const FILE_CATEGORIES = ['client_asset', 'deliverable'] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export function isFileCategory(value: unknown): value is FileCategory {
  return typeof value === 'string' && (FILE_CATEGORIES as readonly string[]).includes(value);
}

/** Storage folder per category. Mirrors public.guard_order_file() in the V8.2 migration. */
export const CATEGORY_FOLDERS: Record<FileCategory, string> = {
  client_asset: 'client_assets',
  deliverable: 'deliverables',
};

/** Reduce a user-supplied file name to a safe storage object name (the original name is kept as metadata). */
export function sanitizeStorageFileName(fileName: string): string {
  const base = fileName.normalize('NFKC').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_');
  const trimmed = base.replace(/^[._]+/, '').slice(-120);
  return trimmed.length > 0 ? trimmed : 'file';
}

export function buildStoragePath(orderId: string, category: FileCategory, fileId: string, fileName: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(orderId)) {
    throw new Error('Invalid order id for storage path.');
  }
  return `orders/${orderId}/${CATEGORY_FOLDERS[category]}/${fileId}_${sanitizeStorageFileName(fileName)}`;
}

/** Returns an error message when the declared file name is unsafe, otherwise null. */
export function validateFileName(fileName: string): string | null {
  if (typeof fileName !== 'string' || fileName.trim().length === 0) return 'A file name is required.';
  if (fileName.length > 200) return 'File name is too long (max 200 characters).';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(fileName)) return 'File name contains control characters.';
  // Separators are never allowed, so ".." can only be a traversal when it is the whole name.
  if (/[\\/]/.test(fileName) || fileName === '.' || fileName === '..') {
    return 'File name must not contain path separators or be "." / "..".';
  }
  return null;
}

export { QA_CHECKLIST_ITEMS } from './qa-checklist';
export type { QaChecklistKey } from './qa-checklist';

/** Returns the keys that are not explicitly confirmed (true) in a submitted checklist. */
export function missingQaChecklistItems(checklist: unknown): QaChecklistKey[] {
  const c =
    checklist && typeof checklist === 'object' && !Array.isArray(checklist)
      ? (checklist as Record<string, unknown>)
      : {};
  return QA_CHECKLIST_ITEMS.filter((i) => c[i.key] !== true).map((i) => i.key);
}

/** Normalises a checklist to exactly the known keys with boolean values. */
export function normaliseQaChecklist(checklist: unknown): Record<QaChecklistKey, boolean> {
  const c =
    checklist && typeof checklist === 'object' && !Array.isArray(checklist)
      ? (checklist as Record<string, unknown>)
      : {};
  const out = {} as Record<QaChecklistKey, boolean>;
  for (const i of QA_CHECKLIST_ITEMS) out[i.key] = c[i.key] === true;
  return out;
}

export function sha256Hex(bytes: Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

const SVG_FORBIDDEN_PATTERNS: Array<[RegExp, string]> = [
  [/<script[\s>/]/i, 'script elements'],
  [/<foreignobject[\s>/]/i, 'foreignObject elements'],
  // <style> is allowed (design tools emit it for fills); its contents are covered by the CSS rules below.
  [/<(iframe|embed|object|audio|video|link|meta|base|form|input|button)[\s>/]/i, 'embedded or active elements'],
  [/<!doctype/i, 'DOCTYPE declarations'],
  [/<!entity/i, 'XML entity declarations'],
  [/<\?xml-stylesheet/i, 'external stylesheets'],
  [/\son[a-z]+\s*=/i, 'event-handler attributes'],
  // Script/data URL schemes only where a URL can appear (attribute value, url(), CSS value) - so ordinary text
  // such as "metadata: ..." is not mistaken for a data: URL.
  [/(?:=\s*["']?|url\s*\(\s*["']?|:)\s*(?:javascript|vbscript|data)\s*:/i, 'script or data URLs'],
  [/expression\s*\(|behavior\s*:|-moz-binding/i, 'scriptable CSS'],
  [/(?:xlink:)?href\s*=\s*["']?\s*(?!#)[^"'\s>]/i, 'external references'],
  [/@import|url\s*\(\s*["']?\s*(?!#)/i, 'external CSS references'],
  [/<(set|animate)[^>]*attributename\s*=\s*["']?\s*(href|xlink:href|on)/i, 'animated link/handler attributes'],
];

/**
 * SVG is XML that browsers can execute. Uploads are accepted only when they are a plain, self-contained
 * <svg> document with no scripts, handlers, entities, external references or embedded HTML. Downloads are
 * additionally served as attachments under a sandboxing CSP (see the files route).
 */
export function inspectSvg(fileBytes: Buffer): FileValidationResult {
  const text = fileBytes.toString('utf8');
  if (text.includes('\u0000')) {
    return { isValid: false, error: 'SVG contains NUL bytes. Upload rejected.' };
  }
  const head = text.slice(0, 2048).replace(/^﻿/, '').trimStart().toLowerCase();
  const startsOk = head.startsWith('<svg') || (head.startsWith('<?xml') && /<svg[\s>]/.test(head));
  if (!startsOk || !/<\/svg>\s*$/i.test(text.trimEnd())) {
    return { isValid: false, error: 'File content does not match declared SVG format.' };
  }
  // Decode numeric character references for ':' so "javascript&#58;" cannot slip past the URL checks.
  const normalised = text.replace(/&#(?:x0*3a|0*58);?/gi, ':').replace(/\s+/g, ' ');
  for (const [pattern, label] of SVG_FORBIDDEN_PATTERNS) {
    if (pattern.test(normalised)) {
      return { isValid: false, error: `SVG rejected: ${label} are not permitted in uploaded SVG files.` };
    }
  }
  return { isValid: true };
}

export class IntakeAndFileManager {
  /**
   * Validates file upload for security and type safety.
   * Prohibits executables, malicious scripts, oversized payloads,
   * and verifies declared MIME type matches actual file magic bytes.
   */
  public static validateUpload(
    fileName: string,
    fileSizeBytes: number,
    mimeType: string,
    fileBytes?: Buffer
  ): FileValidationResult {
    const nameError = validateFileName(fileName);
    if (nameError) return { isValid: false, error: nameError };

    const ext = fileName.includes('.')
      ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
      : '';

    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      return {
        isValid: false,
        error: `Executable and script files (${ext}) are strictly prohibited for platform security.`,
      };
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return {
        isValid: false,
        error: `Invalid file format (${mimeType}). Permitted formats: PNG, JPG, WEBP, SVG, PDF, ZIP.`,
      };
    }

    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        error: `File size exceeds the 25MB limit. Please compress assets or upload a smaller file.`,
      };
    }

    if (fileBytes && fileBytes.length > 0) {
      // Check for executable or script headers regardless of declared type
      if (fileBytes.length >= 2 && fileBytes[0] === 0x4d && fileBytes[1] === 0x5a) {
        return { isValid: false, error: 'Executable binary signature (MZ) detected. Upload rejected.' };
      }
      if (
        fileBytes.length >= 4 &&
        fileBytes[0] === 0x7f &&
        fileBytes[1] === 0x45 &&
        fileBytes[2] === 0x4c &&
        fileBytes[3] === 0x46
      ) {
        return { isValid: false, error: 'Executable ELF binary signature detected. Upload rejected.' };
      }
      if (fileBytes.length >= 2 && fileBytes[0] === 0x23 && fileBytes[1] === 0x21) {
        return { isValid: false, error: 'Script shebang (#!) detected. Upload rejected.' };
      }

      // Check MIME magic bytes
      if (mimeType === 'image/png') {
        const isPng =
          fileBytes.length >= 8 &&
          fileBytes[0] === 0x89 &&
          fileBytes[1] === 0x50 &&
          fileBytes[2] === 0x4e &&
          fileBytes[3] === 0x47 &&
          fileBytes[4] === 0x0d &&
          fileBytes[5] === 0x0a &&
          fileBytes[6] === 0x1a &&
          fileBytes[7] === 0x0a;
        if (!isPng) return { isValid: false, error: 'File content does not match declared PNG image format.' };
      } else if (mimeType === 'image/jpeg') {
        const isJpg =
          fileBytes.length >= 3 &&
          fileBytes[0] === 0xff &&
          fileBytes[1] === 0xd8 &&
          fileBytes[2] === 0xff;
        if (!isJpg) return { isValid: false, error: 'File content does not match declared JPEG image format.' };
      } else if (mimeType === 'application/pdf') {
        const isPdf =
          fileBytes.length >= 4 &&
          fileBytes[0] === 0x25 &&
          fileBytes[1] === 0x50 &&
          fileBytes[2] === 0x44 &&
          fileBytes[3] === 0x46;
        if (!isPdf) return { isValid: false, error: 'File content does not match declared PDF document format.' };
      } else if (mimeType === 'image/webp') {
        const isWebp =
          fileBytes.length >= 12 &&
          fileBytes[0] === 0x52 &&
          fileBytes[1] === 0x49 &&
          fileBytes[2] === 0x46 &&
          fileBytes[3] === 0x46 &&
          fileBytes[8] === 0x57 &&
          fileBytes[9] === 0x45 &&
          fileBytes[10] === 0x42 &&
          fileBytes[11] === 0x50;
        if (!isWebp) return { isValid: false, error: 'File content does not match declared WEBP format.' };
      } else if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') {
        const isZip = fileBytes.length >= 4 && fileBytes[0] === 0x50 && fileBytes[1] === 0x4b;
        if (!isZip) return { isValid: false, error: 'File content does not match declared ZIP archive format.' };
      } else if (mimeType === 'image/svg+xml') {
        const svgCheck = inspectSvg(fileBytes);
        if (!svgCheck.isValid) return svgCheck;
      }
    }

    return { isValid: true };
  }

  /**
   * Create file metadata with private signed URL path.
   */
  public static recordPrivateUpload(
    orderId: string,
    userId: string,
    fileName: string,
    fileSizeBytes: number,
    mimeType: string,
    category: string = 'client_asset'
  ): FileAttachment {
    const validation = this.validateUpload(fileName, fileSizeBytes, mimeType);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    if (!isFileCategory(category)) {
      throw new Error(`Invalid file category '${category}'. Allowed: ${FILE_CATEGORIES.join(', ')}.`);
    }
    const fileId = `file_${crypto.randomBytes(8).toString('hex')}`;
    const storagePath = buildStoragePath(orderId, category, fileId, fileName);

    return {
      id: fileId,
      orderId,
      uploadedByUserId: userId,
      fileName,
      fileSizeBytes,
      mimeType,
      storagePath,
      isPrivate: true,
      category,
      uploadedAt: new Date().toISOString(),
      downloadUrl: `/api/orders/${orderId}/files?download=${fileId}`,
    };
  }

  /**
   * Validate intake submission.
   * Crucial rule: NEVER allows or stores raw passwords in field names or text values.
   */
  public static validateIntakeSubmission(rawInput: Record<string, unknown>): IntakeSubmission {
    const dangerousKeys = Object.keys(rawInput).filter((k) =>
      /password|passcode|secret|credential/i.test(k)
    );
    const hasPlaintextPasswordValue = Object.values(rawInput).some(
      (v) => typeof v === 'string' && /password\s*(is|:|=)|pwd\s*(:|=)/i.test(v)
    );

    if (dangerousKeys.length > 0 || hasPlaintextPasswordValue) {
      throw new Error(
        'Security violation: Passwords must NEVER be submitted in intake forms. Please use delegated partner invitations.'
      );
    }

    const orderId = rawInput.orderId as string;
    const businessName = (rawInput.businessName as string) || '';
    const contactEmail = (rawInput.contactEmail as string) || '';
    const contactWhatsApp = (rawInput.contactWhatsApp as string) || '';
    const partnerInviteStatus =
      (rawInput.partnerInviteStatus as IntakeSubmission['partnerInviteStatus']) ||
      'pending_instructions';

    if (!orderId || !businessName || !contactEmail) {
      throw new Error(
        'Missing required fields: orderId, businessName, and contactEmail are required.'
      );
    }

    return {
      id: `intake_${crypto.randomBytes(6).toString('hex')}`,
      orderId,
      businessName,
      targetAudience: (rawInput.targetAudience as string) || '',
      brandColors: (rawInput.brandColors as string) || '',
      contactEmail,
      contactWhatsApp,
      existingPageLinks: (rawInput.existingPageLinks as string) || '',
      partnerInviteStatus,
      notes: (rawInput.notes as string) || '',
      submittedAt: new Date().toISOString(),
      isComplete: true,
    };
  }
}
