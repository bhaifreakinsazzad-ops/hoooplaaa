import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { SSLCommerzAdapter } from '@/domain/payment-adapter';
import { OrderService } from '@/domain/order-service';

export async function POST(req: NextRequest) {
  try {
    let payload: Record<string, unknown> = {};

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        payload[key] = value.toString();
      });
    }

    const sslAdapter = new SSLCommerzAdapter();
    const verification = await sslAdapter.verifyCallback(payload);

    if (!verification.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: verification.reason || 'Payment verification failed.',
          status: verification.status,
        },
        { status: 400 }
      );
    }

    const order = await persistentDB.getOrder(verification.orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found for verified payment.' },
        { status: 404 }
      );
    }

    const updatedOrder = OrderService.markOrderPaid(order, verification.paymentAttemptId);
    await persistentDB.saveOrder(updatedOrder, order.organizationId);

    return NextResponse.json({
      success: true,
      message: 'Payment verified and order updated to paid.',
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      financialStatus: updatedOrder.financialStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing SSLCOMMERZ callback.' },
      { status: 500 }
    );
  }
}
