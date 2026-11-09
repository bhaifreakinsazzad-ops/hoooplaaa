import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { authenticateRequest, requireOrderAccess } from '@/domain/auth-guard';

/**
 * GET /api/orders/[id]/deliverables
 * Retrieves deliverables, QA records, and deliverable files for the order.
 * Enforces authentication (401) and order ownership / staff role (403).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

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

    const isCustomer = access.user.role === 'customer';
    // Only deliverables the database bound to an owned file + approved QA review are genuinely available.
    const deliverables = (await persistentDB.getDeliverables(order.id)).filter(
      (d) => d.qaChecklistPassed && d.qaReviewUuid && d.fileId
    );
    const deliveredFileIds = new Set(deliverables.map((d) => d.fileId));
    const allFiles = await persistentDB.getFiles(order.id);
    const files = allFiles
      .filter((f) => f.category === 'deliverable' && (!isCustomer || deliveredFileIds.has(f.id)))
      .map((f) => ({
        id: f.id,
        fileName: f.fileName,
        fileSizeBytes: f.fileSizeBytes,
        mimeType: f.mimeType,
        sha256Hash: f.sha256Hash,
        uploadedAt: f.uploadedAt,
        downloadUrl: `/api/orders/${order.id}/files?download=${f.id}`,
      }));
    const qaReviews = isCustomer ? [] : await persistentDB.getQaReviews(order.id);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: order.status,
      deliveredAt: order.deliveredAt || null,
      acceptedAt: order.acceptedAt || null,
      deliverables: deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        verificationNotes: d.verificationNotes,
        qaChecklistPassed: d.qaChecklistPassed,
        fileId: d.fileId,
        fileSha256: d.fileSha256,
        createdAt: d.createdAt,
        downloadUrl: `/api/orders/${order.id}/files?download=${d.fileId}`,
        ...(isCustomer ? {} : { storageBucketPath: d.storageBucketPath, qaReviewId: d.qaReviewId }),
      })),
      files,
      qaReviews,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error fetching deliverables.' },
      { status: 500 }
    );
  }
}
