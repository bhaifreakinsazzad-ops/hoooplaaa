import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { requireOrderAccess } from '@/domain/auth-guard';

/**
 * POST /api/checkout/manual-mfs
 * Requires authenticated session and ownership of the target order.
 * Records the manual MFS reference and keeps financialStatus = 'pending_verification'.
 */
export async function POST(req: NextRequest) {
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

    // Update order status to payment_under_review (never paid automatically)
    const updated = OrderService.markOrderPaymentUnderReview(order, transactionReference);
    await persistentDB.saveOrder(updated, order.organizationId);

    // Update payment attempt in database with customer sender phone and trx reference
    const existingPayments = await persistentDB.getPaymentsForOrder(orderId);
    if (existingPayments.length > 0) {
      const latest = existingPayments[0];
      await persistentDB.recordPaymentAttempt({
        ...latest,
        paymentStatus: 'pending_verification',
        manualSenderPhone: customerPhone || '',
        manualTrxReference: transactionReference,
      });
    } else {
      await persistentDB.recordPaymentAttempt({
        id: `pay_mfs_${Date.now()}`,
        orderId,
        paymentMethod: 'manual_mfs',
        paymentStatus: 'pending_verification',
        amountMinor: order.totalMinor,
        currency: order.currency,
        idempotencyKey: `idemp_mfs_${orderId}_${transactionReference}`,
        manualSenderPhone: customerPhone || '',
        manualTrxReference: transactionReference,
        gatewayRawPayload: { submittedBy: access.user.id },
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message:
        'Payment reference recorded. Status is currently pending manual finance verification.',
      order: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing manual payment submission.' },
      { status: 500 }
    );
  }
}
