import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { requireRole } from '@/domain/auth-guard';
import { rejectCrossOrigin } from '@/domain/guest-claim';

/**
 * GET /api/admin/orders
 * Restricted to authenticated staff roles ('admin', 'finance', 'engineer').
 * Unauthenticated -> 401. Customer -> 403.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'finance', 'engineer']);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const orders = await persistentDB.listAllOrders();
  return NextResponse.json({ success: true, orders });
}

/**
 * POST /api/admin/orders
 * Restricted to authenticated staff roles ('admin', 'engineer').
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'engineer']);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      orderId,
      action,
      specialistId,
      specialistName,
      deliverableTitle,
      deliverablePath,
      verificationNotes,
      revisionNotes,
    } = body;

    const order = await persistentDB.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    let updated = order;

    if (action === 'assign_staff') {
      updated = OrderService.assignStaff(
        order,
        specialistId || auth.user.id,
        specialistName || auth.user.fullName
      );
    } else if (action === 'submit_qa') {
      updated = OrderService.submitForQA(order);
    } else if (action === 'deliver') {
      // 1. Explicit boolean QA checklist approval required (never accept missing/client default)
      if (body.qaChecklistPassed !== true) {
        return NextResponse.json(
          { error: 'Cannot deliver order: Explicit QA checklist approval is required (qaChecklistPassed must be true).' },
          { status: 422 }
        );
      }

      // 2. Deliverable asset verification in private storage
      const orderFiles = await persistentDB.getFiles(order.id);
      let storagePath = '';

      if (body.deliverableFileId) {
        const fileRecord = orderFiles.find((f) => f.id === body.deliverableFileId);
        if (!fileRecord || fileRecord.category === 'client_asset') {
          return NextResponse.json(
            { error: 'Deliverable file not found or is a customer intake asset. Customer intake uploads cannot be used as deliverables.' },
            { status: 422 }
          );
        }
        const exists = await persistentDB.verifyStorageObjectExists('order-assets', fileRecord.storagePath);
        if (!exists) {
          return NextResponse.json(
            { error: 'Deliverable file does not exist in private storage.' },
            { status: 422 }
          );
        }
        storagePath = fileRecord.storagePath;
      } else if (body.deliverablePath) {
        const exists = await persistentDB.verifyStorageObjectExists('order-assets', body.deliverablePath);
        if (!exists) {
          return NextResponse.json(
            { error: 'Deliverable file does not exist in private storage (fabricated path rejected).' },
            { status: 422 }
          );
        }
        storagePath = body.deliverablePath;
      } else {
        // Find existing staff deliverable file in orderFiles
        const staffDeliverable = orderFiles.find((f) => f.category === 'deliverable');
        if (!staffDeliverable) {
          return NextResponse.json(
            { error: 'Cannot deliver order: A genuine deliverable file must exist in private storage before delivery. Customer intake uploads do not count.' },
            { status: 422 }
          );
        }
        const exists = await persistentDB.verifyStorageObjectExists('order-assets', staffDeliverable.storagePath);
        if (!exists) {
          return NextResponse.json(
            { error: 'Deliverable file does not exist in private storage.' },
            { status: 422 }
          );
        }
        storagePath = staffDeliverable.storagePath;
      }

      updated = OrderService.deliverOrder(order, { qaChecklistPassed: true });
      await persistentDB.saveDeliverable({
        orderId: order.id,
        uploadedBy: auth.user.id,
        title: deliverableTitle || 'Setup Verification & Handover Evidence Pack',
        storageBucketPath: storagePath,
        verificationNotes:
          verificationNotes ||
          'All owner-approved setup scope items verified and delegated via official Partner ID.',
        qaChecklistPassed: true,
      });
    } else if (action === 'request_revision') {
      updated = OrderService.requestRevision(order, revisionNotes);
      await persistentDB.saveRevision({
        orderId: order.id,
        requestedBy: auth.user.id,
        revisionNotes: revisionNotes || 'Revision requested on setup configuration.',
      });
    } else if (action === 'accept') {
      // Disallow staff acceptance: only customer may accept delivery
      return NextResponse.json(
        { error: 'Staff cannot accept delivery handover. Only the authorized customer can accept handover through the customer acceptance endpoint.' },
        { status: 403 }
      );
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    await persistentDB.saveOrder(updated, order.organizationId);
    await persistentDB.recordAuditLog({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: `ORDER_ACTION_${String(action).toUpperCase()}`,
      entityType: 'order',
      entityId: orderId,
      metadata: { status: updated.status },
    });

    return NextResponse.json({
      success: true,
      message: `Action ${action} executed successfully.`,
      order: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error updating order.' },
      { status: 400 }
    );
  }
}
