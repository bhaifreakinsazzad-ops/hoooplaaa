import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { persistentDB } from '@/domain/persistent-db';
import { IntakeAndFileManager } from '@/domain/intake-and-files';
import { requireOrderAccess } from '@/domain/auth-guard';
import { rejectCrossOrigin } from '@/domain/guest-claim';

/**
 * POST /api/orders/[id]/files
 * Enforces:
 * - Origin / CSRF protection (403)
 * - Authentication (401)
 * - Tenant ownership (403)
 * - MIME and content magic-byte verification (400)
 * - Real file bytes requirement (400)
 * - Role-enforced category assignment ('client_asset' vs 'deliverable')
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Strict CSRF / Origin protection for cookie-authenticated uploads
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

  try {
    const { id: orderId } = await params;

    const order = await persistentDB.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const access = await requireOrderAccess(req, order);
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    let fileName = '';
    let mimeType = '';
    let fileBytes: Buffer | null = null;
    let requestedCategory: string | null = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const uploadedFile = formData.get('file') as File | null;
      if (!uploadedFile) {
        return NextResponse.json(
          { error: 'Multipart upload must include a valid "file" binary field.' },
          { status: 400 }
        );
      }
      fileName = uploadedFile.name;
      mimeType = uploadedFile.type || 'application/octet-stream';
      requestedCategory = formData.get('category') as string | null;
      const arrayBuffer = await uploadedFile.arrayBuffer();
      fileBytes = Buffer.from(arrayBuffer);
    } else {
      const body = await req.json();
      fileName = body.fileName || '';
      mimeType = body.mimeType || '';
      requestedCategory = body.category || null;
      if (typeof body.fileContentBase64 === 'string' && body.fileContentBase64.length > 0) {
        const cleanBase64 = body.fileContentBase64.replace(/^data:[^;]+;base64,/, '');
        fileBytes = Buffer.from(cleanBase64, 'base64');
      } else if (typeof body.fileContentText === 'string' && body.fileContentText.length > 0) {
        fileBytes = Buffer.from(body.fileContentText, 'utf8');
      }
    }

    if (!fileBytes || fileBytes.byteLength === 0) {
      return NextResponse.json(
        {
          error:
            'Real file bytes are required. Fake metadata-only file records without binary content are prohibited.',
        },
        { status: 400 }
      );
    }

    // 2. Enforce MIME and content integrity checks (including magic bytes)
    const validation = IntakeAndFileManager.validateUpload(
      fileName,
      fileBytes.byteLength,
      mimeType,
      fileBytes
    );
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 3. Enforce category: customers can ONLY upload 'client_asset'
    const isStaff = access.user.role === 'admin' || access.user.role === 'engineer';
    const category = isStaff ? (requestedCategory || 'deliverable') : 'client_asset';

    const baseRecord = IntakeAndFileManager.recordPrivateUpload(
      orderId,
      access.user.id,
      fileName,
      fileBytes.byteLength,
      mimeType,
      category
    );

    const sha256Hash = crypto.createHash('sha256').update(fileBytes).digest('hex');
    const savedRecord = await persistentDB.savePrivateFileWithBytes(
      { ...baseRecord, sha256Hash },
      fileBytes
    );

    return NextResponse.json({
      success: true,
      file: savedRecord,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error uploading file.' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/orders/[id]/files
 * Enforces authentication (401) and tenant ownership / staff access (403).
 * Supports `?download=<fileId>` to stream verified private file bytes.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  const order = await persistentDB.getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const access = await requireOrderAccess(req, order);
  if (!access.authorized) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const downloadFileId = req.nextUrl.searchParams.get('download');
  if (downloadFileId) {
    const privateFile = await persistentDB.getPrivateFileBytes(orderId, downloadFileId);
    if (!privateFile) {
      return NextResponse.json({ error: 'Private file not found.' }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(privateFile.bytes), {
      status: 200,
      headers: {
        'Content-Type': privateFile.file.mimeType,
        'Content-Length': String(privateFile.bytes.byteLength),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(privateFile.file.fileName)}"`,
        'X-Content-SHA256': privateFile.file.sha256Hash,
      },
    });
  }

  const files = await persistentDB.getFiles(orderId);
  return NextResponse.json({ success: true, files });
}
