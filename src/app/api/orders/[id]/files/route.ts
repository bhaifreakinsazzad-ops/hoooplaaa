import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { persistentDB } from '@/domain/persistent-db';
import { IntakeAndFileManager } from '@/domain/intake-and-files';
import { requireOrderAccess } from '@/domain/auth-guard';

/**
 * POST /api/orders/[id]/files
 * Enforces authentication (401), tenant ownership (403), MIME/extension security,
 * and requires REAL file bytes (via multipart/form-data File or base64 payload).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      const arrayBuffer = await uploadedFile.arrayBuffer();
      fileBytes = Buffer.from(arrayBuffer);
    } else {
      const body = await req.json();
      fileName = body.fileName || '';
      mimeType = body.mimeType || '';
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

    const baseRecord = IntakeAndFileManager.recordPrivateUpload(
      orderId,
      access.user.id,
      fileName,
      fileBytes.byteLength,
      mimeType
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
