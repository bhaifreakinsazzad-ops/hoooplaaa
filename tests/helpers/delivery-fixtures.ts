/**
 * V8.2 test fixtures: the only way to produce a delivered order is the real chain
 * staff deliverable upload (bytes + SHA-256) -> persisted, approved QA review -> atomic delivery RPC.
 */
import { persistentDB, StoredOrderFile } from '../../src/domain/persistent-db';
import { IntakeAndFileManager, QA_CHECKLIST_ITEMS } from '../../src/domain/intake-and-files';
import { OrderService } from '../../src/domain/order-service';
import { Order } from '../../src/domain/types';

export const CUSTOMER_A_ID = '00000000-0000-4000-a000-000000000001';
export const ENGINEER_ID = '00000000-0000-4000-a000-000000000004';
export const ADMIN_ID = '00000000-0000-4000-a000-000000000005';

export const FULL_QA_CHECKLIST: Record<string, boolean> = Object.fromEntries(
  QA_CHECKLIST_ITEMS.map((i) => [i.key, true])
);

export const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

export async function uploadStaffDeliverable(
  orderId: string,
  bytes: Buffer = PDF_BYTES,
  fileName = 'handover_pack.pdf',
  uploaderId = ENGINEER_ID
): Promise<StoredOrderFile> {
  const rec = IntakeAndFileManager.recordPrivateUpload(
    orderId,
    uploaderId,
    fileName,
    bytes.byteLength,
    'application/pdf',
    'deliverable'
  );
  await persistentDB.savePrivateFileWithBytes(rec, bytes);
  const stored = await persistentDB.getOrderFile(orderId, rec.id);
  if (!stored) throw new Error('fixture: uploaded deliverable not found');
  return stored;
}

/** Order must already be persisted in 'qa_review' (paid, intake complete). */
export async function approveAndDeliver(
  orderId: string,
  opts: { title?: string; notes?: string; file?: StoredOrderFile } = {}
): Promise<{ file: StoredOrderFile; reviewId: string; order: Order }> {
  const file = opts.file || (await uploadStaffDeliverable(orderId));
  const review = await persistentDB.recordQaReview({
    orderId,
    file,
    reviewerId: ADMIN_ID,
    reviewerRole: 'admin',
    decision: 'approved',
    checklist: FULL_QA_CHECKLIST,
    notes: opts.notes || 'All scope items verified.',
  });
  const current = await persistentDB.getOrder(orderId);
  if (!current) throw new Error('fixture: order not found');
  const delivered = await persistentDB.deliverOrderWithQaApproval({
    order: OrderService.deliverOrder(current, { qaChecklistPassed: true }),
    fileId: file.id,
    qaReviewId: review.id,
    actorId: ENGINEER_ID,
    title: opts.title || 'Setup Handover Pack',
    verificationNotes: opts.notes || 'All scope items verified.',
  });
  return { file, reviewId: review.id, order: delivered };
}

/** Persists a fresh order directly in 'qa_review' (paid + intake complete) for delivery tests. */
export async function seedOrderInQaReview(order: Order, organizationId?: string): Promise<Order> {
  order.financialStatus = 'paid';
  order.intakeStatus = 'completed';
  order.status = 'qa_review';
  order.assignedSpecialistId = order.assignedSpecialistId || ENGINEER_ID;
  return persistentDB.saveOrder(order, organizationId || order.organizationId);
}
