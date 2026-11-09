import { NextRequest, NextResponse } from 'next/server';
import {
  persistentDB,
  OrderTransitionError,
  orderWriteErrorStatus,
  StoredOrderFile,
} from '@/domain/persistent-db';
import { OrderService } from '@/domain/order-service';
import { requireRole } from '@/domain/auth-guard';
import { rejectCrossOrigin } from '@/domain/guest-claim';
import {
  QA_CHECKLIST_ITEMS,
  missingQaChecklistItems,
  normaliseQaChecklist,
} from '@/domain/intake-and-files';
import { Order } from '@/domain/types';

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

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Resolves a deliverable strictly within this order and re-verifies its stored bytes:
 * - the file id must belong to THIS order (ids from other orders and raw storage paths are never accepted),
 * - category must be 'deliverable' (customer intake assets never qualify),
 * - the uploader must be admin/engineer staff,
 * - the Storage object must exist and its recomputed SHA-256 and size must match the recorded values.
 */
async function resolveVerifiedDeliverable(order: Order, fileId: unknown): Promise<StoredOrderFile> {
  if (typeof fileId !== 'string' || fileId.length === 0) {
    throw new HttpError(422, 'A deliverableFileId belonging to this order is required. Raw storage paths are not accepted.');
  }
  const file = await persistentDB.getOrderFile(order.id, fileId);
  if (!file) {
    throw new HttpError(422, 'Deliverable file not found on this order. Files from other orders are rejected.');
  }
  if (file.category !== 'deliverable') {
    throw new HttpError(
      422,
      'Deliverable file not found or is a customer intake asset. Customer intake uploads cannot be used as deliverables.'
    );
  }
  const uploader = await persistentDB.getUserById(file.uploadedByUserId);
  if (!uploader || (uploader.role !== 'admin' && uploader.role !== 'engineer')) {
    throw new HttpError(422, 'Deliverable file was not uploaded by authorised staff.');
  }
  const read = await persistentDB.readVerifiedFile(file);
  if (read.status === 'missing_object') {
    throw new HttpError(422, 'Deliverable file does not exist in private storage.');
  }
  if (read.status === 'oversized') {
    throw new HttpError(422, 'Deliverable file exceeds the permitted size.');
  }
  if (read.status === 'integrity_mismatch') {
    throw new HttpError(422, 'Deliverable file failed SHA-256 integrity verification against its recorded checksum.');
  }
  return file;
}

/**
 * POST /api/admin/orders
 * Restricted to authenticated staff roles ('admin', 'engineer'); same-origin only (CSRF).
 * Actions: assign_staff, submit_qa, qa_review, deliver, request_revision. ('accept' is customer-only.)
 */
export async function POST(req: NextRequest) {
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

  const auth = await requireRole(req, ['admin', 'engineer']);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      orderId,
      action,
      specialistId,
      specialistName,
      deliverableTitle,
      verificationNotes,
      revisionNotes,
    } = body;

    if (typeof orderId !== 'string' || orderId.length === 0) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }
    const order = await persistentDB.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (action === 'accept') {
      return NextResponse.json(
        { error: 'Staff cannot accept delivery handover. Only the authorized customer can accept handover through the customer acceptance endpoint.' },
        { status: 403 }
      );
    }

    let updated: Order;
    let extra: Record<string, unknown> = {};

    if (action === 'assign_staff') {
      updated = await persistentDB.transitionOrder(order.id, (current) =>
        OrderService.assignStaff(current, specialistId || auth.user.id, specialistName || auth.user.fullName)
      );
    } else if (action === 'submit_qa') {
      updated = await persistentDB.transitionOrder(order.id, (current) => OrderService.submitForQA(current));
    } else if (action === 'qa_review') {
      // Persisted QA review: reviewer identity, checklist evidence, timestamp and the exact file digest.
      if (order.status !== 'qa_review') {
        return NextResponse.json(
          { error: `QA review is only possible while the order is in 'qa_review' (current: '${order.status}').` },
          { status: 422 }
        );
      }
      const decision = body.decision;
      if (decision !== 'approved' && decision !== 'rejected') {
        return NextResponse.json({ error: "decision must be 'approved' or 'rejected'." }, { status: 400 });
      }
      const missing = missingQaChecklistItems(body.checklist);
      if (decision === 'approved' && missing.length > 0) {
        return NextResponse.json(
          {
            error: 'QA approval requires every checklist item to be explicitly confirmed.',
            missingChecklistItems: missing,
            checklistItems: QA_CHECKLIST_ITEMS,
          },
          { status: 422 }
        );
      }
      const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '';
      if (decision === 'rejected' && notes.trim().length === 0) {
        return NextResponse.json({ error: 'A rejected QA review must include notes.' }, { status: 400 });
      }
      const file = await resolveVerifiedDeliverable(order, body.deliverableFileId);
      const review = await persistentDB.recordQaReview({
        orderId: order.id,
        file,
        reviewerId: auth.user.id,
        reviewerRole: auth.user.role,
        decision,
        checklist: normaliseQaChecklist(body.checklist),
        notes,
      });
      if (decision === 'rejected') {
        updated = await persistentDB.transitionOrder(order.id, (current) => OrderService.returnFromQa(current));
      } else {
        updated = order;
      }
      extra = { qaReview: review };
    } else if (action === 'deliver') {
      // A request flag (e.g. qaChecklistPassed: true) never constitutes QA approval. Delivery requires a
      // persisted, approved QA review of an owned, checksum-verified deliverable; the database re-checks all
      // of it inside one atomic, version-checked transaction.
      if (typeof body.qaReviewId !== 'string' || body.qaReviewId.length === 0) {
        return NextResponse.json(
          { error: 'Cannot deliver order: a persisted, approved QA review (qaReviewId) is required. Request flags such as qaChecklistPassed are not accepted as QA approval.' },
          { status: 422 }
        );
      }
      const file = await resolveVerifiedDeliverable(order, body.deliverableFileId);
      const reviews = await persistentDB.getQaReviews(order.id);
      const review = reviews.find((r) => r.id === body.qaReviewId);
      if (!review || review.fileId !== file.id) {
        return NextResponse.json({ error: 'QA review not found for this deliverable file.' }, { status: 422 });
      }
      if (review.decision !== 'approved') {
        return NextResponse.json({ error: 'QA review is not an approval.' }, { status: 422 });
      }
      if (review.fileSha256 !== file.sha256Hash) {
        return NextResponse.json({ error: 'QA review does not match the current file checksum.' }, { status: 422 });
      }

      const prepared = OrderService.deliverOrder(order, { qaChecklistPassed: true });
      updated = await persistentDB.deliverOrderWithQaApproval({
        order: { ...prepared, rowVersion: order.rowVersion },
        fileId: file.id,
        qaReviewId: review.id,
        actorId: auth.user.id,
        title: typeof deliverableTitle === 'string' && deliverableTitle.trim() ? deliverableTitle.slice(0, 200) : file.fileName,
        verificationNotes: typeof verificationNotes === 'string' ? verificationNotes.slice(0, 2000) : review.notes,
      });
    } else if (action === 'request_revision') {
      updated = await persistentDB.transitionOrder(order.id, (current) =>
        OrderService.requestRevision(current, revisionNotes)
      );
      await persistentDB.saveRevision({
        orderId: order.id,
        requestedBy: auth.user.id,
        revisionNotes: revisionNotes || 'Revision requested on setup configuration.',
      });
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    await persistentDB.recordAuditLog({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: `ORDER_ACTION_${String(action).toUpperCase()}`,
      entityType: 'order',
      entityId: orderId,
      metadata: { status: updated.status, rowVersion: updated.rowVersion },
    });

    return NextResponse.json({
      success: true,
      message: `Action ${action} executed successfully.`,
      order: updated,
      ...extra,
    });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // 409 stale version, 422 database-refused transition / QA evidence, 400 for service-level precondition errors.
    const status = error instanceof OrderTransitionError ? 422 : orderWriteErrorStatus(error);
    return NextResponse.json({ error: error?.message || 'Error updating order.' }, { status });
  }
}
