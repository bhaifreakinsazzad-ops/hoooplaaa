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
   * Prohibits executables, malicious scripts, and oversized payloads.
   */
  public static validateUpload(
    fileName: string,
    fileSizeBytes: number,
    mimeType: string
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
    mimeType: string
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
