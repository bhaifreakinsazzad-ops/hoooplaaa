import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { requireRole } from '@/domain/auth-guard';

/**
 * POST /api/admin/finance/verify
 * Strictly restricted to authenticated 'finance' and 'admin' roles.
 * Unauthenticated -> 401. Customer or Engineer -> 403.
 * Staff identity is derived EXCLUSIVELY from the verified server session (`auth.user.id`), never from `req.body`.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['finance', 'admin']);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { orderId, approved, rejectionReason } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    const order = await persistentDB.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Authoritative staff identity from verified session (ignores any body.verifiedByStaffId)
    const verifiedByStaffId = auth.user.id;
    const now = new Date().toISOString();

    if (approved) {
      const updated = OrderService.markOrderPaid(
        order,
        `FIN-VERIFIED-${verifiedByStaffId.slice(0, 8)}-${Date.now()}`
      );
      await persistentDB.saveOrder(updated, order.organizationId);

      // Update associated manual payment record in database
      const payments = await persistentDB.getPaymentsForOrder(orderId);
      if (payments.length > 0) {
        const latest = payments[0];
        await persistentDB.recordPaymentAttempt({
          ...latest,
          paymentStatus: 'verified',
          verifiedByFinanceId: verifiedByStaffId,
          verifiedAt: now,
        });
      }

      await persistentDB.recordAuditLog({
        actorId: verifiedByStaffId,
        actorRole: auth.user.role,
        action: 'FINANCE_PAYMENT_APPROVED',
        entityType: 'order',
        entityId: orderId,
        metadata: {
          verifiedByEmail: auth.user.email,
          amountMinor: order.totalMinor,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Payment officially verified by finance. Order marked as paid.',
        verifiedByStaffId,
        order: updated,
      });
    } else {
      const updated = {
        ...order,
        financialStatus: 'unpaid' as const,
        status: 'awaiting_payment' as const,
      };
      await persistentDB.saveOrder(updated, order.organizationId);

      const payments = await persistentDB.getPaymentsForOrder(orderId);
      if (payments.length > 0) {
        const latest = payments[0];
        await persistentDB.recordPaymentAttempt({
          ...latest,
          paymentStatus: 'failed',
          verifiedByFinanceId: verifiedByStaffId,
          verifiedAt: now,
          rejectionReason: rejectionReason || 'Reference not found on settlement statement',
        });
      }

      await persistentDB.recordAuditLog({
        actorId: verifiedByStaffId,
        actorRole: auth.user.role,
        action: 'FINANCE_PAYMENT_REJECTED',
        entityType: 'order',
        entityId: orderId,
        metadata: {
          verifiedByEmail: auth.user.email,
          rejectionReason: rejectionReason || 'Reference not found on statement',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Payment reference rejected: ${rejectionReason || 'Reference not found on statement'}.`,
        verifiedByStaffId,
        order: updated,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing finance verification.' },
      { status: 500 }
    );
  }
}
