import { NextRequest, NextResponse } from 'next/server';
import { orderStore } from '@/domain/store';
import { OrderService } from '@/domain/order-service';

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

    const order = orderStore.get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Update order status to payment_under_review
    const updated = OrderService.markOrderPaymentUnderReview(order, transactionReference);
    orderStore.set(updated.id, updated);

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
