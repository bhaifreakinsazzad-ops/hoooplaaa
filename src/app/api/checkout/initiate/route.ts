import { NextRequest, NextResponse } from 'next/server';
import { quoteStore, orderStore } from '@/domain/store';
import { OrderService } from '@/domain/order-service';
import { SSLCommerzAdapter, ManualMFSAdapter } from '@/domain/payment-adapter';
import { Order, PaymentMethod } from '@/domain/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteId, customerEmail, paymentMethod } = body;

    if (!quoteId || !customerEmail || !paymentMethod) {
      return NextResponse.json(
        { error: 'quoteId, customerEmail, and paymentMethod are required.' },
        { status: 400 }
      );
    }

    const quote = quoteStore.get(quoteId);
    if (!quote) {
      return NextResponse.json(
        { error: 'Quote snapshot not found or expired. Please reconfigure.' },
        { status: 404 }
      );
    }

    if (!quote.eligibility.canSelfCheckout) {
      return NextResponse.json(
        { error: 'This quote requires manual review and cannot proceed to automated checkout.' },
        { status: 403 }
      );
    }

    // Customer ID derived from email
    const customerUserId = `usr_${Buffer.from(customerEmail).toString('hex').slice(0, 10)}`;

    // Create immutable order from quote
    const order = OrderService.createOrderFromQuote(quote, customerUserId);
    orderStore.set(order.id, order);

    const idempotencyKey = `idemp_${order.id}_${Date.now()}`;

    // Initiate payment via chosen adapter
    if (paymentMethod === 'sslcommerz') {
      const sslAdapter = new SSLCommerzAdapter();
      const initResult = await sslAdapter.initiatePayment(order, idempotencyKey);
      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        redirectUrl: initResult.gatewayUrl,
      });
    } else if (paymentMethod === 'manual_mfs') {
      const mfsAdapter = new ManualMFSAdapter();
      const initResult = await mfsAdapter.initiatePayment(order, idempotencyKey);
      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        manualDetails: initResult.manualPaymentDetails,
      });
    } else {
      return NextResponse.json({ error: 'Unsupported payment method.' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error initiating order checkout.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('id');
  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
  }

  const order = orderStore.get(orderId);
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, order });
}
