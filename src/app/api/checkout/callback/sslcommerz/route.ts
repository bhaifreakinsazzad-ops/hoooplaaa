import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { SSLCommerzAdapter } from '@/domain/payment-adapter';

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

    const valId = (payload.val_id as string) || '';

    // Atomic synchronization: transitions order to paid and payment record to verified
    const settled = await persistentDB.settleOrderPaymentPaid({
      orderId: verification.orderId,
      paymentAttemptId: verification.paymentAttemptId,
      providerValId: valId,
      evidencePayload: payload,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment verified and order updated to paid.',
      orderId: settled.order.id,
      orderNumber: settled.order.orderNumber,
      status: settled.order.status,
      financialStatus: settled.order.financialStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing SSLCOMMERZ callback.' },
      { status: 500 }
    );
  }
}
