import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { authenticateRequest, requireOrderAccess } from '@/domain/auth-guard';

/**
 * GET /api/orders/[id]/deliverables
 * Retrieves deliverables, QA records, and deliverable files for the order.
 * Enforces authentication (401) and order ownership / staff role (403).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id: orderId } = await params;
    const order = await persistentDB.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const access = await requireOrderAccess(req, order);
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const deliverables = await persistentDB.getDeliverables(orderId);
    const files = await persistentDB.getFiles(orderId);

    return NextResponse.json({
      success: true,
      orderId,
      status: order.status,
      deliveredAt: order.deliveredAt || null,
      acceptedAt: order.acceptedAt || null,
      deliverables,
      files,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error fetching deliverables.' },
      { status: 500 }
    );
  }
}
