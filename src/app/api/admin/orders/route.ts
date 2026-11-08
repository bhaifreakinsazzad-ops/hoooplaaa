import { NextRequest, NextResponse } from 'next/server';
import { orderStore } from '@/domain/store';
import { OrderService } from '@/domain/order-service';

export async function GET() {
  const orders = Array.from(orderStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return NextResponse.json({ success: true, orders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action, specialistId, specialistName } = body;

    const order = orderStore.get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    let updated = order;

    if (action === 'assign_staff') {
      updated = OrderService.assignStaff(
        order,
        specialistId || 'staff_01',
        specialistName || 'Hoooplaaa Specialist'
      );
    } else if (action === 'submit_qa') {
      updated = OrderService.submitForQA(order);
    } else if (action === 'deliver') {
      updated = OrderService.deliverOrder(order);
    } else if (action === 'accept') {
      updated = OrderService.acceptHandover(order);
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    orderStore.set(orderId, updated);

    return NextResponse.json({
      success: true,
      message: `Action ${action} executed successfully.`,
      order: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error updating order.' },
      { status: 500 }
    );
  }
}
