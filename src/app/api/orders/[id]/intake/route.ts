import { NextRequest, NextResponse } from 'next/server';
import { orderStore, intakeStore } from '@/domain/store';
import { IntakeAndFileManager } from '@/domain/intake-and-files';
import { OrderService } from '@/domain/order-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json();

    const order = orderStore.get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Security check: validate that no passwords are being passed
    const intakeSubmission = IntakeAndFileManager.validateIntakeSubmission({
      ...body,
      orderId,
    });

    // Save intake record
    intakeStore.set(orderId, intakeSubmission);

    // Update order intake status and trigger SLA clock if paid
    const updatedOrder = OrderService.completeIntake(order);
    orderStore.set(orderId, updatedOrder);

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const intake = intakeStore.get(orderId);
  return NextResponse.json({ success: true, intake: intake || null });
}
