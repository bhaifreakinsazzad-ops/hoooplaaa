import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { requireOrderAccess } from '@/domain/auth-guard';
import { rejectCrossOrigin } from '@/domain/guest-claim';

/**
 * POST /api/checkout/manual-mfs
 * Requires authenticated session and ownership of the target order.
 * Records the manual MFS reference and keeps financialStatus = 'pending_verification'.
 */
export async function POST(req: NextRequest) {
  // CSRF: cookie-authenticated state change must be same-origin.
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

  try {
    const body = await req.json();
    const { orderId, transactionReference, customerPhone } = body;

    if (!orderId || !transactionReference) {
      return NextResponse.json(
        { error: 'orderId and transactionReference are required.' },
        { status: 400 }
      );
    }

    const order = await persistentDB.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const access = await requireOrderAccess(req, order);
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    if (order.financialStatus === 'paid') {
      return NextResponse.json({ error: 'This order is already paid.' }, { status: 409 });
    }

    // The reference can only be attached to an existing MANUAL attempt that the customer opened through
    // checkout. No payment records are invented here and a gateway attempt can never be re-labelled.
    const existingPayments = await persistentDB.getPaymentsForOrder(orderId);
    const manualAttempt = existingPayments.find(
      (p) =>
        p.paymentMethod === 'manual_mfs' &&
        (p.paymentStatus === 'initiated' || p.paymentStatus === 'pending_verification')
    );
    if (!manualAttempt) {
      return NextResponse.json(
        { error: 'No open manual payment attempt exists for this order. Start a manual payment from checkout first.' },
        { status: 409 }
      );
    }

    // Update order status to payment_under_review (never paid automatically)
    const updated = OrderService.markOrderPaymentUnderReview(order, transactionReference);
    await persistentDB.saveOrder(updated, order.organizationId);

    await persistentDB.recordPaymentAttempt({
      ...manualAttempt,
      paymentStatus: 'pending_verification',
      manualSenderPhone: customerPhone || '',
      manualTrxReference: String(transactionReference).trim(),
      gatewayRawPayload: { ...manualAttempt.gatewayRawPayload, submittedBy: access.user.id },
    });

    return NextResponse.json({
      success: true,
      message:
        'Payment reference recorded. Status is currently pending manual finance verification.',
      order: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing manual payment submission.' },
      { status: error?.name === 'OrderConcurrencyError' ? 409 : error?.name === 'OrderTransitionError' ? 422 : 500 }
    );
  }
}
