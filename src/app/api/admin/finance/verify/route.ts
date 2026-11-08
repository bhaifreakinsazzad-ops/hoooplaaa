import { NextRequest, NextResponse } from 'next/server';
import { orderStore } from '@/domain/store';
import { OrderService } from '@/domain/order-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, approved, rejectionReason, verifiedByStaffId } = body;

    const order = orderStore.get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (approved) {
      // Finance verified funds against bank/MFS statement
      const updated = OrderService.markOrderPaid(order, `FIN-VERIFIED-${Date.now()}`);
      orderStore.set(orderId, updated);

      return NextResponse.json({
        success: true,
        message: 'Payment officially verified by finance. Order marked as paid.',
        order: updated,
      });
    } else {
      const updated = { ...order };
      updated.financialStatus = 'unpaid';
      updated.status = 'awaiting_payment';
      orderStore.set(orderId, updated);

      return NextResponse.json({
        success: true,
        message: `Payment reference rejected: ${rejectionReason || 'Reference not found on statement'}.`,
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
