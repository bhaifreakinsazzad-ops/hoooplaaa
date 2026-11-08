import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
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

    // Priority 2: Enforce actual settlement evidence — prohibit fictional payment generation
    const payments = await persistentDB.getPaymentsForOrder(orderId);
    const pendingPayment = payments.find(
      (p) => p.paymentStatus === 'pending_verification' || p.paymentStatus === 'initiated'
    );

    if (!pendingPayment) {
      return NextResponse.json(
        {
          error:
            'Unprocessable Entity: No matching pending payment attempt found for this order. Finance verification requires an existing pending payment record.',
        },
        { status: 422 }
      );
    }

    if (approved) {
      // Atomic payment settlement: updates order to paid, payment to verified, and logs audit in PostgreSQL
      const settled = await persistentDB.settleOrderPaymentPaid({
        orderId,
        paymentAttemptId: pendingPayment.id,
        verifiedByStaffId,
        evidencePayload: {
          approvedByStaffId: verifiedByStaffId,
          approvedByEmail: auth.user.email,
          verifiedAt: now,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Payment officially verified by finance. Order marked as paid.',
        verifiedByStaffId,
        order: settled.order,
      });
    } else {
      const updated = {
        ...order,
        financialStatus: 'unpaid' as const,
        status: 'awaiting_payment' as const,
      };
      await persistentDB.saveOrder(updated, order.organizationId);

      await persistentDB.recordPaymentAttempt({
        ...pendingPayment,
        paymentStatus: 'failed',
        verifiedByFinanceId: verifiedByStaffId,
        verifiedAt: now,
        rejectionReason: rejectionReason || 'Reference not found on settlement statement',
      });

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
