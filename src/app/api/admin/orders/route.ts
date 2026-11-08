import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { requireRole } from '@/domain/auth-guard';

/**
 * GET /api/admin/orders
 * Restricted to authenticated staff roles ('admin', 'finance', 'engineer').
 * Unauthenticated -> 401. Customer -> 403.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'finance', 'engineer']);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const orders = await persistentDB.listAllOrders();
  return NextResponse.json({ success: true, orders });
}

/**
 * POST /api/admin/orders
 * Restricted to authenticated staff roles ('admin', 'engineer').
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'engineer']);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { orderId, action, specialistId, specialistName } = body;

    const order = await persistentDB.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    let updated = order;

    if (action === 'assign_staff') {
      updated = OrderService.assignStaff(
        order,
        specialistId || auth.user.id,
        specialistName || auth.user.fullName
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

    await persistentDB.saveOrder(updated, order.organizationId);
    await persistentDB.recordAuditLog({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: `ORDER_ACTION_${String(action).toUpperCase()}`,
      entityType: 'order',
      entityId: orderId,
      metadata: { status: updated.status },
    });

    return NextResponse.json({
      success: true,
      message: `Action ${action} executed successfully.`,
      order: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error updating order.' },
      { status: 400 }
    );
  }
}
