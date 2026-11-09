import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { authenticateRequest, requireOrderAccess } from '@/domain/auth-guard';
import { rejectCrossOrigin } from '@/domain/guest-claim';

/**
 * POST /api/orders/[id]/accept
 * Customer endpoint to review deliverables and officially accept handover.
 * Enforces:
 * - Origin / CSRF protection for state-changing request
 * - Customer authentication (401)
 * - Order tenant ownership / access validation (403)
 * - Order must be paid (422)
 * - Order must be in 'delivered' state (422)
 * - Real deliverables or handover files must exist (422)
 * - Idempotent if already accepted (200)
 * - Records ORDER_HANDOVER_ACCEPTED in audit_logs
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

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

    // Idempotency: if already accepted, return current order state cleanly
    if (order.status === 'accepted') {
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
        message: 'Order handover has already been accepted.',
        order,
      });
    }

    if (order.financialStatus !== 'paid') {
      return NextResponse.json(
        { error: 'Cannot accept handover: Order is unpaid.' },
        { status: 422 }
      );
    }

    if (order.status !== 'delivered') {
      return NextResponse.json(
        {
          error: `Cannot accept handover: Order must be delivered before customer acceptance (current status: '${order.status}').`,
        },
        { status: 422 }
      );
    }

    // Verify deliverables exist in record or file storage
    const deliverables = await persistentDB.getDeliverables(order.id);
    const orderFiles = await persistentDB.getFiles(order.id);
    if (deliverables.length === 0 && orderFiles.length === 0) {
      return NextResponse.json(
        { error: 'Cannot accept handover: No verified deliverable exists for this order.' },
        { status: 422 }
      );
    }

    const updated = OrderService.acceptHandover(order, access.user.id);
    await persistentDB.saveOrder(updated, order.organizationId);

    await persistentDB.recordAuditLog({
      actorId: access.user.id,
      actorRole: access.user.role,
      action: 'ORDER_HANDOVER_ACCEPTED',
      entityType: 'order',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        acceptedAt: updated.acceptedAt,
        acceptedByEmail: access.user.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order handover accepted successfully.',
      order: updated,
    });
  } catch (error: any) {
    const msg = error?.message || 'Error accepting order handover.';
    const status = msg.startsWith('Illegal state transition') ? 422 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
