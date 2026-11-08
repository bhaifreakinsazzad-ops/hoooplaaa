import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from '@/domain/persistent-db';
import { IntakeAndFileManager } from '@/domain/intake-and-files';
import { OrderService } from '@/domain/order-service';
import { requireOrderAccess } from '@/domain/auth-guard';

/**
 * POST /api/orders/[id]/intake
 * Enforces authentication (401), tenant ownership (403), and zero-password validation (400).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const body = await req.json();

    // Security check: validate that no passwords are being passed in keys or values
    const intakeSubmission = IntakeAndFileManager.validateIntakeSubmission({
      ...body,
      orderId,
    });

    await persistentDB.saveIntake(intakeSubmission, access.user.id);

    // Update order intake status and trigger SLA clock if paid
    const updatedOrder = OrderService.completeIntake(order);
    await persistentDB.saveOrder(updatedOrder, order.organizationId);

    return NextResponse.json({
      success: true,
      message: 'Intake submitted successfully. Fulfillment readiness updated.',
      order: updatedOrder,
      intake: intakeSubmission,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing intake submission.' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/orders/[id]/intake
 * Enforces authentication (401) and tenant ownership / staff access (403).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  const order = await persistentDB.getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const access = await requireOrderAccess(req, order);
  if (!access.authorized) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const intake = await persistentDB.getIntake(orderId);
  return NextResponse.json({ success: true, intake: intake || null });
}
