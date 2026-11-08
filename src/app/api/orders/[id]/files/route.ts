import { NextRequest, NextResponse } from 'next/server';
import { orderStore, fileStore } from '@/domain/store';
import { IntakeAndFileManager } from '@/domain/intake-and-files';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json();
    const { fileName, fileSizeBytes, mimeType, userId } = body;

    const order = orderStore.get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const fileRecord = IntakeAndFileManager.recordPrivateUpload(
      orderId,
      userId || order.customerUserId,
      fileName,
      fileSizeBytes,
      mimeType
    );

    const existing = fileStore.get(orderId) || [];
    existing.push(fileRecord);
    fileStore.set(orderId, existing);

    return NextResponse.json({
      success: true,
      file: fileRecord,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error uploading file.' },
      { status: 400 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const files = fileStore.get(orderId) || [];
  return NextResponse.json({ success: true, files });
}
