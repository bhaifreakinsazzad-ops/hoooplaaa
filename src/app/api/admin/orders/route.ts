import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { requireRole } from '@/domain/auth-guard';

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
      const qaPassed = body.qaPassed !== false && body.qaChecklistPassed !== false;
      if (!qaPassed) {
        return NextResponse.json(
          { error: 'Cannot deliver order: QA checklist must be passed.' },
          { status: 422 }
        );
      }

      // Check if real files exist for this order in private storage or if an explicit path was supplied
      const orderFiles = await persistentDB.getFiles(order.id);
      const storagePath =
        deliverablePath || (orderFiles.length > 0 ? orderFiles[0].storagePath : `orders/${order.id}/handover-pack.pdf`);

      updated = OrderService.deliverOrder(order, { qaChecklistPassed: qaPassed });
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
      updated = OrderService.acceptHandover(order, auth.user.id);
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
