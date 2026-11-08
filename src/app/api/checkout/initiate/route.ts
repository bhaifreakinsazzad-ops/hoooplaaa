import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { SSLCommerzAdapter, ManualMFSAdapter } from '@/domain/payment-adapter';
import { authenticateRequest, requireOrderAccess } from '@/domain/auth-guard';

/**
 * POST /api/checkout/initiate
 * Requires authenticated user session (401 if unauthenticated).
 * Binds order ownership to authenticated user ID and organization ID.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { quoteId, paymentMethod } = body;

    if (!quoteId || !paymentMethod) {
      return NextResponse.json(
        { error: 'quoteId and paymentMethod are required.' },
        { status: 400 }
      );
    }

    const quote = await persistentDB.getQuote(quoteId);
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

    // Bind order strictly to authenticated session user & tenant
    const order = OrderService.createOrderFromQuote(quote, auth.user.id);
    await persistentDB.saveOrder(order, auth.user.organizationId);

    const idempotencyKey = `idemp_${order.id}_${Date.now()}`;

    if (paymentMethod === 'sslcommerz') {
      const sslAdapter = new SSLCommerzAdapter();
      const initResult = await sslAdapter.initiatePayment(order, idempotencyKey);
      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        attemptId: initResult.attemptId,
        redirectUrl: initResult.gatewayUrl,
      });
    } else if (paymentMethod === 'manual_mfs') {
      const mfsAdapter = new ManualMFSAdapter();
      const initResult = await mfsAdapter.initiatePayment(order, idempotencyKey);
      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        attemptId: initResult.attemptId,
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

/**
 * GET /api/checkout/initiate?id=<orderId>
 * Requires authenticated session (401) and tenant ownership / staff role (403).
 * If no `id` param is provided, returns all orders belonging to the authenticated customer.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('id');

  if (!orderId) {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const orders = await persistentDB.listOrdersForCustomer(
      auth.user.id,
      auth.user.organizationId
    );
    return NextResponse.json({ success: true, orders });
  }

  const order = await persistentDB.getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const access = await requireOrderAccess(req, order);
  if (!access.authorized) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  return NextResponse.json({ success: true, order });
}
