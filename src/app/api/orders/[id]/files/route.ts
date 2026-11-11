import { NextRequest, NextResponse } from 'next/server';
import { persistentDB, StoredOrderFile } from '@/domain/persistent-db';
import {
  IntakeAndFileManager,
  MAX_FILE_SIZE_BYTES,
  maxUploadRequestBytes,
  isFileCategory,
  sha256Hex,
} from '@/domain/intake-and-files';
import { requireOrderAccess } from '@/domain/auth-guard';
import { rejectCrossOrigin } from '@/domain/guest-claim';

/** Public shape of a file: no internal storage paths or row ids. */
function toPublicFile(f: StoredOrderFile) {
  return {
    id: f.id,
    orderId: f.orderId,
    fileName: f.fileName,
    fileSizeBytes: f.fileSizeBytes,
    mimeType: f.mimeType,
    category: f.category,
    sha256Hash: f.sha256Hash,
    uploadedAt: f.uploadedAt,
    isPrivate: true,
    downloadUrl: `/api/orders/${f.orderId}/files?download=${f.id}`,
  };
}

/**
 * Customers see their own intake assets plus deliverable files that were actually delivered (bound to a
 * delivered, QA-approved deliverable record). Staff work-in-progress deliverables stay internal.
 */
async function visibleFilesFor(orderId: string, role: string): Promise<StoredOrderFile[]> {
  const files = await persistentDB.getFiles(orderId);
  if (role !== 'customer') return files;
  const delivered = new Set(
    (await persistentDB.getDeliverables(orderId)).filter((d) => d.qaReviewUuid && d.fileId).map((d) => d.fileId)
  );
  return files.filter((f) => f.category === 'client_asset' || delivered.has(f.id));
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * POST /api/orders/[id]/files
 * Enforces:
 * - Origin / CSRF protection (403)
 * - Authentication (401)
 * - Tenant ownership (403)
 * - Size limit before buffering (413), real bytes (400), MIME + magic bytes + SVG safety (400)
 * - Role-enforced category ('client_asset' for customers; staff choose 'client_asset' | 'deliverable')
 * - Category-specific storage path; SHA-256 computed from the exact received bytes
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

    const declaredLength = Number(req.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > maxUploadRequestBytes(req.headers.get('content-type') || '')) {
      return NextResponse.json({ error: 'File size exceeds the 25MB limit.' }, { status: 413 });
    }

    let fileName = '';
    let mimeType = '';
    let fileBytes: Buffer | null = null;
    let requestedCategory: unknown = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const uploadedFile = formData.get('file');
      if (!uploadedFile || typeof uploadedFile === 'string') {
        return NextResponse.json(
          { error: 'Multipart upload must include a valid "file" binary field.' },
          { status: 400 }
        );
      }
      if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'File size exceeds the 25MB limit.' }, { status: 413 });
      }
      fileName = uploadedFile.name;
      mimeType = uploadedFile.type || 'application/octet-stream';
      requestedCategory = formData.get('category');
      fileBytes = Buffer.from(await uploadedFile.arrayBuffer());
    } else {
      const body = await req.json();
      fileName = typeof body.fileName === 'string' ? body.fileName : '';
      mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
      requestedCategory = body.category ?? null;
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
    if (fileBytes.byteLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File size exceeds the 25MB limit.' }, { status: 413 });
    }

    // 2. Enforce MIME and content integrity checks (including magic bytes and SVG safety)
    const validation = IntakeAndFileManager.validateUpload(
      fileName,
      fileBytes.byteLength,
      mimeType,
      fileBytes
    );
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 3. Category: customers can ONLY upload 'client_asset'; staff must name a known category.
    const isStaff = access.user.role === 'admin' || access.user.role === 'engineer';
    let category: 'client_asset' | 'deliverable' = 'client_asset';
    if (isStaff) {
      const wanted = requestedCategory === null || requestedCategory === '' ? 'deliverable' : requestedCategory;
      if (!isFileCategory(wanted)) {
        return NextResponse.json(
          { error: "Invalid file category. Allowed: 'client_asset', 'deliverable'." },
          { status: 400 }
        );
      }
      category = wanted;
    } else if (access.user.role !== 'customer') {
      return NextResponse.json({ error: 'Only customers and fulfilment staff can upload order files.' }, { status: 403 });
    }

    const baseRecord = IntakeAndFileManager.recordPrivateUpload(
      orderId,
      access.user.id,
      fileName,
      fileBytes.byteLength,
      mimeType,
      category
    );

    const savedRecord = await persistentDB.savePrivateFileWithBytes(
      { ...baseRecord, orderId: order.id, sha256Hash: sha256Hex(fileBytes) },
      fileBytes
    );

    return NextResponse.json({
      success: true,
      file: {
        id: savedRecord.id,
        orderId: order.id,
        fileName: savedRecord.fileName,
        fileSizeBytes: savedRecord.fileSizeBytes,
        mimeType: savedRecord.mimeType,
        category: savedRecord.category,
        sha256Hash: savedRecord.sha256Hash,
        uploadedAt: savedRecord.uploadedAt,
        isPrivate: true,
        downloadUrl: savedRecord.downloadUrl,
      },
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
 * `?download=<fileId>` streams the ORIGINAL bytes only after re-computing SHA-256 and comparing it with the
 * digest recorded at upload. Missing (404/410), corrupted (409) and oversized (413) objects are never served.
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

  const visible = await visibleFilesFor(order.id, access.user.role);

  const downloadFileId = req.nextUrl.searchParams.get('download');
  if (downloadFileId) {
    const file = visible.find((f) => f.id === downloadFileId);
    if (!file) {
      return NextResponse.json({ error: 'Private file not found.' }, { status: 404 });
    }
    const read = await persistentDB.readVerifiedFile(file);
    if (read.status !== 'ok') {
      await persistentDB.recordAuditLog({
        actorId: access.user.id,
        actorRole: access.user.role,
        action: 'FILE_INTEGRITY_FAILURE',
        entityType: 'order_file',
        entityId: file.id,
        metadata: { orderId: order.id, status: read.status, expectedSha256: file.sha256Hash },
      });
      if (read.status === 'missing_object') {
        return NextResponse.json({ error: 'Stored file content is missing.' }, { status: 410 });
      }
      if (read.status === 'oversized') {
        return NextResponse.json({ error: 'Stored file exceeds the permitted size.' }, { status: 413 });
      }
      return NextResponse.json(
        { error: 'Stored file failed SHA-256 integrity verification and was not served.' },
        { status: 409 }
      );
    }
    return new NextResponse(new Uint8Array(read.bytes), {
      status: 200,
      headers: {
        // SVG and every other type are downloaded, never rendered inline from our origin.
        'Content-Type': read.file.mimeType === 'image/svg+xml' ? 'application/octet-stream' : read.file.mimeType,
        'Content-Length': String(read.bytes.byteLength),
        'Content-Disposition': contentDisposition(read.file.fileName),
        'X-Content-SHA256': sha256Hex(read.bytes),
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return NextResponse.json({ success: true, files: visible.map(toPublicFile) });
}
