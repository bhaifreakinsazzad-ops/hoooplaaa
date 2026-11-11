import { NextRequest, NextResponse } from 'next/server';
import { persistentDB, orderWriteErrorStatus } from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { authenticateRequest, requireOrderAccess } from '@/domain/auth-guard';
import { rejectCrossOrigin } from '@/domain/guest-claim';

/**
 * POST /api/orders/[id]/accept
 * Customer endpoint to review deliverables and officially accept handover.
 * Enforces:
 * - Origin / CSRF protection for state-changing request (403)
 * - Customer authentication (401)
 * - Order tenant ownership / access validation (403)
 * - Customer-only acceptance (staff cannot accept for customer) (403)
 * - Order must be paid (422)
 * - Order must be in 'delivered' state (422)
 * - Real, QA-approved deliverable must exist in private storage (422)
 * - Customer intake uploads NEVER count as completed deliverables
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

    // Handover acceptance is strictly reserved for the customer (staff cannot accept for customer)
    if (access.user.role !== 'customer') {
      return NextResponse.json(
        { error: 'Staff cannot accept delivery handover. Only the authorized customer can accept handover through the customer acceptance endpoint.' },
        { status: 403 }
      );
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

    // Verify genuine, QA-approved deliverables exist in private storage (customer intake files NEVER count)
    const deliverables = await persistentDB.getDeliverables(order.id);
    if (deliverables.length === 0) {
      return NextResponse.json(
        { error: 'Cannot accept handover: No verified deliverable exists for this order. Customer intake files do not count.' },
        { status: 422 }
      );
    }

    // Only deliverables bound (in the database) to an approved QA review and an owned staff file count, and
    // the stored bytes must still match the recorded SHA-256.
    let verifiedDeliverableFound = false;
    for (const d of deliverables) {
      if (d.qaChecklistPassed !== true || !d.qaReviewUuid || !d.fileId) continue;
      const file = await persistentDB.getOrderFile(order.id, d.fileId);
      if (!file || file.category !== 'deliverable' || file.sha256Hash !== d.fileSha256) continue;
      const read = await persistentDB.readVerifiedFile(file);
      if (read.status === 'ok') {
        verifiedDeliverableFound = true;
        break;
      }
    }

    if (!verifiedDeliverableFound) {
      return NextResponse.json(
        { error: 'Cannot accept handover: Deliverable records must have passed QA and confirmed storage assets before customer acceptance.' },
        { status: 422 }
      );
    }

    // Version-checked: a concurrent acceptance resolves idempotently (no second write, no second audit row).
    let acceptedNow = false;
    const updated = await persistentDB.transitionOrder(order.id, (current) => {
      acceptedNow = false; // re-evaluated on every retry attempt
      if (current.status === 'accepted') return null;
      acceptedNow = true;
      return OrderService.acceptHandover(current, access.user.id);
    });

    if (!acceptedNow) {
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
        message: 'Order handover has already been accepted.',
        order: updated,
      });
    }

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
      message: 'Handover accepted successfully.',
      order: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing handover acceptance.' },
      { status: error?.name === 'OrderConcurrencyError' || error?.name === 'OrderTransitionError' ? orderWriteErrorStatus(error) : 500 }
    );
  }
}
