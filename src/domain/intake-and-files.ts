import { FileAttachment, IntakeSubmission } from './types';
import crypto from 'crypto';

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

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
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
        const text = fileBytes.slice(0, 1024).toString('utf8').toLowerCase();
        if (!text.includes('<svg') && !text.includes('<?xml')) {
          return { isValid: false, error: 'File content does not match declared SVG format.' };
        }
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

    const fileId = `file_${crypto.randomBytes(8).toString('hex')}`;
    const storagePath = `orders/${orderId}/client_assets/${fileId}_${encodeURIComponent(fileName)}`;

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
