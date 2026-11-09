import { NextRequest, NextResponse } from 'next/server';
import { persistentDB, orderWriteErrorStatus } from '@/domain/persistent-db';
import { IntakeAndFileManager } from '@/domain/intake-and-files';
import { OrderService } from '@/domain/order-service';
import { requireOrderAccess } from '@/domain/auth-guard';
import { rejectCrossOrigin } from '@/domain/guest-claim';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/orders/[id]/intake
 * Enforces same-origin (CSRF, 403), authentication (401), tenant ownership (403) and zero-password
 * validation (400). The contact email is taken from the authenticated session for customers; it is never a
 * user id or other placeholder. The order update is version-checked (stale writes cannot undo payment/SLA).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

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

    const sessionEmail = String(access.user.email || '').trim().toLowerCase();
    const submittedEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim().toLowerCase() : '';
    const contactEmail = access.user.role === 'customer' ? sessionEmail : submittedEmail || sessionEmail;
    if (!EMAIL_RE.test(contactEmail)) {
      return NextResponse.json(
        { error: 'A valid contact email is required. Customers use the email address of their signed-in account.' },
        { status: 400 }
      );
    }

    // Security check: validate that no passwords are being passed in keys or values
    const intakeSubmission = IntakeAndFileManager.validateIntakeSubmission({
      ...body,
      contactEmail,
      orderId,
    });

    await persistentDB.saveIntake(intakeSubmission, access.user.id);

    // Update intake status (and start SLA only if already paid) on the LATEST order state.
    const updatedOrder = await persistentDB.transitionOrder(order.id, (current) =>
      OrderService.completeIntake(current)
    );

    return NextResponse.json({
      success: true,
      message: 'Intake submitted successfully. Fulfillment readiness updated.',
      order: updatedOrder,
      intake: intakeSubmission,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing intake submission.' },
      { status: orderWriteErrorStatus(error) }
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
