import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  persistentDB,
  toDeterministicUuid,
  OrderConcurrencyError,
} from '../src/domain/persistent-db';
import { OrderService, getBusinessCalendar } from '../src/domain/order-service';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { authenticateCredentials } from '../src/domain/auth-guard';
import { SSLCommerzAdapter } from '../src/domain/payment-adapter';
import { IntakeAndFileManager, inspectSvg, buildStoragePath } from '../src/domain/intake-and-files';
import {
  getInitializedTestPostgres,
  resetTestPostgresData,
  supabasePgliteFetch,
} from '../src/testing/supabase-pglite-bridge';
import { POST as adminOrdersPost } from '../src/app/api/admin/orders/route';
import { POST as acceptPost } from '../src/app/api/orders/[id]/accept/route';
import { POST as intakePost } from '../src/app/api/orders/[id]/intake/route';
import { GET as deliverablesGet } from '../src/app/api/orders/[id]/deliverables/route';
import { POST as filesPost, GET as filesGet } from '../src/app/api/orders/[id]/files/route';
import { PATCH as sessionPatch, DELETE as sessionDelete } from '../src/app/api/auth/session/route';
import { POST as financeVerifyPost } from '../src/app/api/admin/finance/verify/route';
import { POST as manualMfsPost } from '../src/app/api/checkout/manual-mfs/route';
import { POST as auditPost } from '../src/app/api/audit/route';
import { POST as checkoutInitiatePost } from '../src/app/api/checkout/initiate/route';
import { POST as quotePost } from '../src/app/api/quote/route';
import { Order } from '../src/domain/types';
import {
  ADMIN_ID,
  CUSTOMER_A_ID,
  ENGINEER_ID,
  FULL_QA_CHECKLIST,
  PDF_BYTES,
  approveAndDeliver,
  seedOrderInQaReview,
  uploadStaffDeliverable,
} from './helpers/delivery-fixtures';

/**
 * Directive V8.2 — release-integrity regression suite.
 * LOCAL ONLY (PGlite + real PostgreSQL roles). Proves SQL/route logic; not a deployed Supabase project.
 */

const BASE = 'http://localhost:3000';
const ORG_A = '10000000-0000-4000-a000-000000000001';
const EVIL = 'https://evil.example';

function req(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return new NextRequest(`${BASE}${path}`, {
    method: init.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function login(email: string, pass: string) {
  const auth = await authenticateCredentials(email, pass);
  if (!auth) throw new Error(`Login failed for ${email}`);
  return auth.token;
}

const tokens = {
  alice: () => login('alice@dhakaheritage.bd', 'CustomerA#2026!'),
  bob: () => login('bob@chittagongtraders.bd', 'CustomerB#2026!'),
  admin: () => login('admin@hoooplaaa.com', 'Admin#2026!'),
  engineer: () => login('engineer@hoooplaaa.com', 'Engineer#2026!'),
  finance: () => login('finance@hoooplaaa.com', 'Finance#2026!'),
};

function newOrder(name: string, sku = 'HI-SET-META'): Order {
  const quote = calculateServerQuote({
    businessId: `biz-${name}`,
    businessName: name,
    businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
    selectedPlatformSkus: [sku],
    selectedAddonSkus: [],
  });
  const order = OrderService.createOrderFromQuote(quote, CUSTOMER_A_ID);
  order.organizationId = ORG_A;
  return order;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

/** Runs SQL as a real PostgreSQL role inside a transaction (rolled back on error). */
async function asRole<T = any>(role: 'service_role' | 'authenticated' | 'anon', sql: string, params: unknown[] = []) {
  const pg = await getInitializedTestPostgres();
  return pg.transaction(async (tx) => {
    await tx.query(`SET LOCAL ROLE ${role}`);
    return tx.query<T>(sql, params as any[]);
  });
}

async function sqlError(role: 'service_role' | 'authenticated' | 'anon', sql: string, params: unknown[] = []) {
  try {
    await asRole(role, sql, params);
    return null;
  } catch (e: any) {
    return String(e?.message || e);
  }
}

async function tamperStorage(storagePath: string, bytes: Buffer) {
  const { error } = await persistentDB
    .getSupabaseAdminClient()
    .storage.from('order-assets')
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(error.message);
}

async function qaReviewVia(token: string, order: Order, fileId: string, body: Record<string, unknown> = {}) {
  return adminOrdersPost(
    req('/api/admin/orders', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { orderId: order.id, action: 'qa_review', decision: 'approved', checklist: FULL_QA_CHECKLIST, deliverableFileId: fileId, ...body },
    })
  );
}

async function deliverVia(token: string, order: Order, fileId: string, qaReviewId: string) {
  return adminOrdersPost(
    req('/api/admin/orders', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { orderId: order.id, action: 'deliver', deliverableFileId: fileId, qaReviewId },
    })
  );
}

/** Creates a real paid order through payment attempt + settlement RPC. */
async function paidOrderViaSettlement(name: string): Promise<Order> {
  const quote = calculateServerQuote({
    businessId: ORG_A,
    businessName: name,
    businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
    selectedPlatformSkus: ['HI-SET-META'],
    selectedAddonSkus: [],
  });
  await persistentDB.saveQuote(quote, CUSTOMER_A_ID, ORG_A);
  const { order } = await persistentDB.createOrGetActiveOrderForQuote({
    quote,
    customerId: CUSTOMER_A_ID,
    organizationId: ORG_A,
  });
  const ssl = new SSLCommerzAdapter();
  const init = await ssl.initiatePayment(order, `idem_${name}`);
  const valId = `VAL_${crypto.randomBytes(4).toString('hex')}`;
  await persistentDB.settleOrderPaymentPaid({
    orderId: order.id,
    paymentAttemptId: init.attemptId,
    source: 'local_simulator',
    providerValId: valId,
    evidencePayload: { status: 'VALID', tranId: init.attemptId, valId, amountMinor: order.totalMinor, currency: 'BDT' },
  });
  return (await persistentDB.getOrder(order.id))!;
}

describe('Directive V8.2 — Release Integrity', () => {
  beforeEach(async () => {
    await resetTestPostgresData();
  });

  // ===========================================================================
  // 1. DELIVERABLE OWNERSHIP
  // ===========================================================================
  describe('1. Secure deliverable ownership', () => {
    it('1.1 rejects a deliverable file that belongs to a different order (QA review and delivery)', async () => {
      const admin = await tokens.admin();
      const orderA = newOrder('Owner A');
      const orderB = newOrder('Owner B');
      await seedOrderInQaReview(orderA);
      await seedOrderInQaReview(orderB);
      const fileOfB = await uploadStaffDeliverable(orderB.id);

      const qa = await qaReviewVia(admin, orderA, fileOfB.id);
      expect(qa.status).toBe(422);
      expect((await qa.json()).error).toMatch(/not found on this order/i);

      // Even with a valid approved review for B, B's file cannot deliver A.
      const { reviewId } = await (async () => {
        const r = await qaReviewVia(admin, orderB, fileOfB.id);
        return { reviewId: (await r.json()).qaReview.id };
      })();
      const del = await deliverVia(admin, orderA, fileOfB.id, reviewId);
      expect(del.status).toBe(422);
      expect((await persistentDB.getOrder(orderA.id))?.status).toBe('qa_review');
    });

    it('1.2 rejects an approved review of order B being used to deliver order A with A\'s own file', async () => {
      const admin = await tokens.admin();
      const orderA = newOrder('Cross Review A');
      const orderB = newOrder('Cross Review B');
      await seedOrderInQaReview(orderA);
      await seedOrderInQaReview(orderB);
      const fileA = await uploadStaffDeliverable(orderA.id);
      const fileB = await uploadStaffDeliverable(orderB.id);
      const reviewB = (await (await qaReviewVia(admin, orderB, fileB.id)).json()).qaReview;

      const del = await deliverVia(admin, orderA, fileA.id, reviewB.id);
      expect(del.status).toBe(422);
      expect((await del.json()).error).toMatch(/QA review not found for this deliverable/i);
    });

    it('1.3 rejects a deliverable whose stored bytes no longer match the recorded checksum', async () => {
      const admin = await tokens.admin();
      const order = newOrder('Tampered Bytes');
      await seedOrderInQaReview(order);
      const file = await uploadStaffDeliverable(order.id);
      await tamperStorage(file.storagePath, Buffer.from('%PDF-1.4 tampered content'));

      const qa = await qaReviewVia(admin, order, file.id);
      expect(qa.status).toBe(422);
      expect((await qa.json()).error).toMatch(/SHA-256 integrity verification/i);
    });

    it('1.4 rejects a deliverable metadata row with no Storage object behind it', async () => {
      const admin = await tokens.admin();
      const order = newOrder('Phantom Object');
      await seedOrderInQaReview(order);
      const fileCode = `file_${crypto.randomBytes(8).toString('hex')}`;
      await asRole(
        'service_role',
        `INSERT INTO public.order_files (file_code, order_id, uploaded_by, file_name, file_size_bytes, mime_type,
           sha256_hash, storage_path, file_category, payload_json)
         VALUES ($1, $2, $3, 'ghost.pdf', 10, 'application/pdf', $4, $5, 'deliverable', '{}'::jsonb)`,
        [fileCode, toDeterministicUuid(`order:${order.id}`), ENGINEER_ID, 'a'.repeat(64),
          `orders/${order.id}/deliverables/${fileCode}_ghost.pdf`]
      );
      const qa = await qaReviewVia(admin, order, fileCode);
      expect(qa.status).toBe(422);
      expect((await qa.json()).error).toMatch(/does not exist in private storage/i);
    });

    it('1.5 database refuses deliverable rows uploaded by customers, outside the order prefix, or in the client folder', async () => {
      const order = newOrder('DB File Guard');
      await persistentDB.saveOrder(order, ORG_A);
      const orderUuid = toDeterministicUuid(`order:${order.id}`);
      const insert = (uploader: string, p: string, category: string) =>
        sqlError(
          'service_role',
          `INSERT INTO public.order_files (file_code, order_id, uploaded_by, file_name, file_size_bytes, mime_type,
             sha256_hash, storage_path, file_category, payload_json)
           VALUES ($1, $2, $3, 'x.pdf', 10, 'application/pdf', $4, $5, $6, '{}'::jsonb)`,
          [`file_${crypto.randomBytes(6).toString('hex')}`, orderUuid, uploader, 'b'.repeat(64), p, category]
        );

      expect(await insert(CUSTOMER_A_ID, `orders/${order.id}/deliverables/x.pdf`, 'deliverable')).toMatch(/ORDER_FILE_DELIVERABLE_UPLOADER/);
      expect(await insert(ENGINEER_ID, `orders/ord_other/deliverables/x.pdf`, 'deliverable')).toMatch(/ORDER_FILE_PATH_INVALID/);
      expect(await insert(ENGINEER_ID, `orders/${order.id}/client_assets/x.pdf`, 'deliverable')).toMatch(/ORDER_FILE_PATH_INVALID/);
      expect(await insert(ENGINEER_ID, `orders/${order.id}/deliverables/../client_assets/x.pdf`, 'deliverable')).toMatch(/ORDER_FILE_PATH_INVALID/);
      expect(await insert(ENGINEER_ID, `orders/${order.id}/deliverables/x.pdf`, 'evil')).toMatch(/ORDER_FILE_CATEGORY_INVALID/);
      expect(await insert(ENGINEER_ID, `orders/${order.id}/deliverables/ok.pdf`, 'deliverable')).toBeNull();
    });

    it('1.6 order file binding, digest and category are immutable once stored', async () => {
      const order = newOrder('Immutable File');
      await seedOrderInQaReview(order);
      const file = await uploadStaffDeliverable(order.id);
      expect(
        await sqlError('service_role', `UPDATE public.order_files SET sha256_hash = $1 WHERE file_code = $2`, ['c'.repeat(64), file.id])
      ).toMatch(/ORDER_FILE_IMMUTABLE/);
      expect(
        await sqlError('service_role', `UPDATE public.order_files SET file_category = 'client_asset' WHERE file_code = $1`, [file.id])
      ).toMatch(/ORDER_FILE_IMMUTABLE/);
    });
  });

  // ===========================================================================
  // 2. PERSISTED QA APPROVAL
  // ===========================================================================
  describe('2. Genuine persisted QA approval', () => {
    it('2.1 persists reviewer identity, role, checklist evidence, timestamp and the exact file digest', async () => {
      const engineer = await tokens.engineer();
      const order = newOrder('QA Evidence');
      await seedOrderInQaReview(order);
      const file = await uploadStaffDeliverable(order.id);
      const res = await qaReviewVia(engineer, order, file.id, { notes: 'Verified partner access and page roles.' });
      expect(res.status).toBe(200);

      const rows = await asRole<any>('service_role', `SELECT * FROM public.order_qa_reviews WHERE order_id = $1`, [
        toDeterministicUuid(`order:${order.id}`),
      ]);
      expect(rows.rows.length).toBe(1);
      const row = rows.rows[0];
      expect(row.reviewer_id).toBe(ENGINEER_ID);
      expect(row.reviewer_role).toBe('engineer');
      expect(row.decision).toBe('approved');
      expect(row.file_sha256).toBe(crypto.createHash('sha256').update(PDF_BYTES).digest('hex'));
      expect(row.checklist).toEqual(FULL_QA_CHECKLIST);
      expect(row.created_at).toBeTruthy();
      expect(row.notes).toMatch(/partner access/);
    });

    it('2.2 approval with an incomplete checklist is refused by the API and by the database', async () => {
      const admin = await tokens.admin();
      const order = newOrder('QA Checklist');
      await seedOrderInQaReview(order);
      const file = await uploadStaffDeliverable(order.id);
      const partial = { ...FULL_QA_CHECKLIST, no_customer_credentials_collected: false };
      const res = await qaReviewVia(admin, order, file.id, { checklist: partial });
      expect(res.status).toBe(422);
      expect((await res.json()).missingChecklistItems).toEqual(['no_customer_credentials_collected']);

      const dbErr = await sqlError(
        'service_role',
        `INSERT INTO public.order_qa_reviews (review_code, order_id, deliverable_file_id, file_sha256, reviewer_id,
           reviewer_role, decision, checklist)
         VALUES ('qa_direct', $1, $2, $3, $4, 'admin', 'approved', $5::jsonb)`,
        [toDeterministicUuid(`order:${order.id}`), file.fileUuid, file.sha256Hash, ADMIN_ID, JSON.stringify(partial)]
      );
      expect(dbErr).toMatch(/QA_CHECKLIST_INCOMPLETE/);
    });

    it('2.3 customers and finance cannot record QA; the database refuses non-staff reviewers and digest mismatches', async () => {
      const order = newOrder('QA Authorisation');
      await seedOrderInQaReview(order);
      const file = await uploadStaffDeliverable(order.id);
      for (const t of [await tokens.alice(), await tokens.finance()]) {
        const res = await qaReviewVia(t, order, file.id);
        expect(res.status).toBe(403);
      }
      const insert = (reviewer: string, role: string, sha: string) =>
        sqlError(
          'service_role',
          `INSERT INTO public.order_qa_reviews (review_code, order_id, deliverable_file_id, file_sha256, reviewer_id,
             reviewer_role, decision, checklist)
           VALUES ($1, $2, $3, $4, $5, $6::public.user_role_enum, 'approved', $7::jsonb)`,
          [`qa_${crypto.randomBytes(4).toString('hex')}`, toDeterministicUuid(`order:${order.id}`), file.fileUuid, sha,
            reviewer, role, JSON.stringify(FULL_QA_CHECKLIST)]
        );
      expect(await insert(CUSTOMER_A_ID, 'customer', file.sha256Hash)).toMatch(/QA_REVIEWER_NOT_AUTHORISED/);
      expect(await insert(CUSTOMER_A_ID, 'admin', file.sha256Hash)).toMatch(/QA_REVIEWER_NOT_AUTHORISED/);
      expect(await insert(ADMIN_ID, 'admin', 'd'.repeat(64))).toMatch(/QA_FILE_DIGEST_MISMATCH/);
    });

    it('2.4 QA evidence is immutable and invisible to anon/authenticated clients', async () => {
      const order = newOrder('QA Immutable');
      await seedOrderInQaReview(order);
      await approveAndDeliver(order.id);

      expect(await sqlError('service_role', `UPDATE public.order_qa_reviews SET decision = 'rejected'`)).toMatch(/permission denied/i);
      expect(await sqlError('service_role', `DELETE FROM public.order_qa_reviews`)).toMatch(/permission denied/i);
      expect(await sqlError('service_role', `UPDATE public.order_deliverables SET title = 'x'`)).toMatch(/permission denied/i);
      expect(await sqlError('authenticated', `SELECT * FROM public.order_qa_reviews`)).toMatch(/permission denied/i);
      expect(await sqlError('anon', `SELECT * FROM public.order_qa_reviews`)).toMatch(/permission denied/i);
      expect(
        await sqlError('authenticated', `SELECT public.deliver_order_with_qa_approval('x', 0, 'f', 'q', $1, 't', 'n', '{}'::jsonb)`, [ADMIN_ID])
      ).toMatch(/permission denied/i);
    });

    it('2.5 the database refuses a direct status write to delivered without an approved QA review', async () => {
      const order = newOrder('Direct Deliver');
      await seedOrderInQaReview(order);
      const err = await sqlError(
        'service_role',
        `UPDATE public.orders SET order_status = 'delivered', delivered_at = now() WHERE order_code = $1`,
        [order.id]
      );
      expect(err).toMatch(/ORDER_QA_APPROVAL_REQUIRED/);
    });

    it('2.6 a rejected review returns the order to in_progress and supersedes an earlier approval', async () => {
      const admin = await tokens.admin();
      const order = newOrder('QA Superseded');
      await seedOrderInQaReview(order);
      const file = await uploadStaffDeliverable(order.id);
      const approved = (await (await qaReviewVia(admin, order, file.id)).json()).qaReview;
      const rejected = await qaReviewVia(admin, order, file.id, { decision: 'rejected', checklist: {}, notes: 'Instagram link missing.' });
      expect(rejected.status).toBe(200);
      expect((await rejected.json()).order.status).toBe('in_progress');

      // Back to QA, then try to deliver with the stale approval.
      const resubmit = await adminOrdersPost(
        req('/api/admin/orders', { method: 'POST', headers: { authorization: `Bearer ${admin}` }, body: { orderId: order.id, action: 'submit_qa' } })
      );
      expect(resubmit.status).toBe(200);
      const del = await deliverVia(admin, order, file.id, approved.id);
      expect(del.status).toBe(422);
      expect((await del.json()).error).toMatch(/DELIVERY_QA_SUPERSEDED/);
    });

    it('2.7 after a revision request, a pre-revision approval can no longer deliver', async () => {
      const admin = await tokens.admin();
      const order = newOrder('QA Revision');
      await seedOrderInQaReview(order);
      const { file, reviewId } = await approveAndDeliver(order.id);

      const rev = await adminOrdersPost(
        req('/api/admin/orders', {
          method: 'POST',
          headers: { authorization: `Bearer ${admin}` },
          body: { orderId: order.id, action: 'request_revision', revisionNotes: 'Fix cover photo.' },
        })
      );
      expect(rev.status).toBe(200);
      await adminOrdersPost(
        req('/api/admin/orders', { method: 'POST', headers: { authorization: `Bearer ${admin}` }, body: { orderId: order.id, action: 'submit_qa' } })
      );
      const del = await deliverVia(admin, order, file.id, reviewId);
      expect(del.status).toBe(422);
      expect((await del.json()).error).toMatch(/ORDER_QA_APPROVAL_REQUIRED/);
      expect((await persistentDB.getDeliverables(order.id)).length).toBe(1); // rolled back atomically

      // A fresh approval after the revision delivers.
      const fresh = (await (await qaReviewVia(admin, order, file.id)).json()).qaReview;
      expect((await deliverVia(admin, order, file.id, fresh.id)).status).toBe(200);
    });
  });

  // ===========================================================================
  // 3. CSRF
  // ===========================================================================
  describe('3. Complete CSRF protection on cookie-authenticated state changes', () => {
    it('3.1 rejects cross-origin requests on every state-changing endpoint (Origin and Sec-Fetch-Site)', async () => {
      const alice = await tokens.alice();
      const admin = await tokens.admin();
      const order = newOrder('CSRF Target');
      await persistentDB.saveOrder(order, ORG_A);

      const cases: Array<[string, () => Promise<Response>]> = [];
      for (const hostile of [{ origin: EVIL }, { 'sec-fetch-site': 'cross-site' }] as Array<Record<string, string>>) {
        const h = (token: string) => ({ authorization: `Bearer ${token}`, ...hostile });
        cases.push(
          ['intake', () => intakePost(req(`/api/orders/${order.id}/intake`, { method: 'POST', headers: h(alice), body: { businessName: 'x' } }), ctx(order.id))],
          ['profile', () => sessionPatch(req('/api/auth/session', { method: 'PATCH', headers: h(alice), body: { fullName: 'Mallory' } }))],
          ['logout', () => sessionDelete(req('/api/auth/session', { method: 'DELETE', headers: h(alice) }))],
          ['staff action', () => adminOrdersPost(req('/api/admin/orders', { method: 'POST', headers: h(admin), body: { orderId: order.id, action: 'submit_qa' } }))],
          ['upload', () => filesPost(req(`/api/orders/${order.id}/files`, { method: 'POST', headers: h(alice), body: { fileName: 'a.pdf', mimeType: 'application/pdf', fileContentBase64: PDF_BYTES.toString('base64') } }), ctx(order.id))],
          ['acceptance', () => acceptPost(req(`/api/orders/${order.id}/accept`, { method: 'POST', headers: h(alice) }), ctx(order.id))],
          ['finance verify', () => financeVerifyPost(req('/api/admin/finance/verify', { method: 'POST', headers: h(admin), body: { orderId: order.id, approved: true } }))],
          ['manual mfs', () => manualMfsPost(req('/api/checkout/manual-mfs', { method: 'POST', headers: h(alice), body: { orderId: order.id } }))],
          ['audit request', () => auditPost(req('/api/audit', { method: 'POST', headers: h(alice), body: {} }))],
          ['checkout initiate', () => checkoutInitiatePost(req('/api/checkout/initiate', { method: 'POST', headers: h(alice), body: {} }))],
          ['quote', () => quotePost(req('/api/quote', { method: 'POST', headers: h(alice), body: {} }))]
        );
      }
      for (const [name, run] of cases) {
        const res = await run();
        expect(res.status, `${name} must reject cross-origin`).toBe(403);
      }
      // Nothing changed.
      expect((await persistentDB.getIntake(order.id)) || null).toBeNull();
      expect((await persistentDB.getFiles(order.id)).length).toBe(0);
    });

    it('3.2 same-origin intake still works', async () => {
      const alice = await tokens.alice();
      const order = newOrder('CSRF Same Origin');
      await persistentDB.saveOrder(order, ORG_A);
      const res = await intakePost(
        req(`/api/orders/${order.id}/intake`, {
          method: 'POST',
          headers: { authorization: `Bearer ${alice}`, origin: BASE, 'sec-fetch-site': 'same-origin' },
          body: { businessName: 'Same Origin Ltd', targetAudience: 'Dhaka', contactWhatsApp: '01700000000' },
        }),
        ctx(order.id)
      );
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // 4. ATOMIC, VERSIONED ORDER TRANSITIONS
  // ===========================================================================
  describe('4. Atomic order state transitions', () => {
    it('4.1 a stale writer cannot overwrite a newer state (compare-and-swap on row_version)', async () => {
      const order = newOrder('CAS Writers');
      await seedOrderInQaReview(order);
      const snapshot = (await persistentDB.getOrder(order.id))!;
      const writerA = { ...snapshot, assignedSpecialistName: 'Writer A' };
      const writerB = { ...snapshot, assignedSpecialistName: 'Writer B' };
      const savedA = await persistentDB.saveOrder(writerA, ORG_A);
      expect(savedA.rowVersion).toBe((snapshot.rowVersion || 0) + 1);
      await expect(persistentDB.saveOrder(writerB, ORG_A)).rejects.toBeInstanceOf(OrderConcurrencyError);
      expect((await persistentDB.getOrder(order.id))?.assignedSpecialistName).toBe('Writer A');
    });

    it('4.2 an existing order cannot be written without a database-read version', async () => {
      const order = newOrder('CAS No Version');
      await persistentDB.saveOrder(order, ORG_A);
      const { rowVersion: _drop, ...noVersion } = (await persistentDB.getOrder(order.id))!;
      await expect(persistentDB.saveOrder(noVersion as Order, ORG_A)).rejects.toBeInstanceOf(OrderConcurrencyError);
    });

    it('4.3 a stale intake write racing settlement cannot reverse payment; the retry keeps paid and starts the SLA', async () => {
      const quote = calculateServerQuote({
        businessId: ORG_A,
        businessName: 'Race Co',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      await persistentDB.saveQuote(quote, CUSTOMER_A_ID, ORG_A);
      const { order } = await persistentDB.createOrGetActiveOrderForQuote({ quote, customerId: CUSTOMER_A_ID, organizationId: ORG_A });
      const ssl = new SSLCommerzAdapter();
      const init = await ssl.initiatePayment(order, 'idem_race');

      const staleUnpaid = (await persistentDB.getOrder(order.id))!; // intake handler read this BEFORE settlement
      await persistentDB.settleOrderPaymentPaid({
        orderId: order.id,
        paymentAttemptId: init.attemptId,
        source: 'local_simulator',
        providerValId: 'VAL_RACE_1',
        evidencePayload: { status: 'VALID', tranId: init.attemptId, valId: 'VAL_RACE_1', amountMinor: order.totalMinor, currency: 'BDT' },
      });

      // The pre-V8.2 bug: saving the stale snapshot would flip paid -> unpaid. Now it is refused.
      await expect(persistentDB.saveOrder(OrderService.completeIntake(staleUnpaid), ORG_A)).rejects.toBeInstanceOf(OrderConcurrencyError);
      const stillPaid = (await persistentDB.getOrder(order.id))!;
      expect(stillPaid.financialStatus).toBe('paid');

      // The route's retrying transition re-applies intake on fresh state.
      const done = await persistentDB.transitionOrder(order.id, (cur) => OrderService.completeIntake(cur));
      expect(done.financialStatus).toBe('paid');
      expect(done.status).toBe('ready_for_fulfillment');
      expect(done.slaStartedAt).toBeTruthy();
    });

    it('4.4 database blocks payment regression, unpaid fulfilment, paid-without-evidence and SLA/acceptance rewrites', async () => {
      const paid = await paidOrderViaSettlement('Guard Paid');
      const unpaid = newOrder('Guard Unpaid');
      await persistentDB.saveOrder(unpaid, ORG_A);

      const upd = (code: string, set: string) =>
        sqlError('service_role', `UPDATE public.orders SET ${set} WHERE order_code = $1`, [code]);

      expect(await upd(paid.id, `financial_status = 'unpaid'`)).toMatch(/ORDER_STATE_REGRESSION/);
      expect(await upd(unpaid.id, `financial_status = 'paid'`)).toMatch(/ORDER_PAYMENT_EVIDENCE_REQUIRED/);
      expect(await upd(unpaid.id, `order_status = 'delivered', delivered_at = now()`)).toMatch(/ORDER_ILLEGAL_TRANSITION/);
      expect(await upd(unpaid.id, `order_status = 'payment_under_review'`)).toBeNull();
      expect(await upd(unpaid.id, `total_minor = 1`)).toMatch(/ORDER_IMMUTABLE_FIELD/);
      expect(await upd(unpaid.id, `sla_started_at = now()`)).toMatch(/ORDER_SLA_PRECONDITION/);

      const done = await persistentDB.transitionOrder(paid.id, (c) => OrderService.completeIntake(c));
      expect(done.slaStartedAt).toBeTruthy();
      expect(await upd(paid.id, `sla_started_at = NULL`)).toMatch(/ORDER_STATE_REGRESSION/);
      expect(await upd(paid.id, `intake_status = 'not_started'`)).toMatch(/ORDER_STATE_REGRESSION/);
    });

    it('4.5 accepted orders cannot be moved back; acceptance timestamp is immutable', async () => {
      const order = newOrder('Guard Accepted');
      await seedOrderInQaReview(order);
      await approveAndDeliver(order.id);
      const delivered = (await persistentDB.getOrder(order.id))!;
      await persistentDB.saveOrder(OrderService.acceptHandover(delivered), ORG_A);

      const upd = (set: string) => sqlError('service_role', `UPDATE public.orders SET ${set} WHERE order_code = $1`, [order.id]);
      expect(await upd(`order_status = 'in_progress'`)).toMatch(/ORDER_ILLEGAL_TRANSITION/);
      expect(await upd(`order_status = 'delivered'`)).toMatch(/ORDER_ILLEGAL_TRANSITION/);
      expect(await upd(`accepted_at = now() + interval '1 day'`)).toMatch(/ORDER_STATE_REGRESSION/);
    });

    it('4.6 every write — including the settlement RPC — bumps row_version', async () => {
      const quote = calculateServerQuote({
        businessId: ORG_A,
        businessName: 'Version Bump',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      await persistentDB.saveQuote(quote, CUSTOMER_A_ID, ORG_A);
      const { order } = await persistentDB.createOrGetActiveOrderForQuote({ quote, customerId: CUSTOMER_A_ID, organizationId: ORG_A });
      const before = (await persistentDB.getOrder(order.id))!.rowVersion!;
      const init = await new SSLCommerzAdapter().initiatePayment(order, 'idem_bump');
      await persistentDB.settleOrderPaymentPaid({
        orderId: order.id,
        paymentAttemptId: init.attemptId,
        source: 'local_simulator',
        providerValId: 'VAL_BUMP',
        evidencePayload: { status: 'VALID', tranId: init.attemptId, valId: 'VAL_BUMP', amountMinor: order.totalMinor, currency: 'BDT' },
      });
      const after = (await persistentDB.getOrder(order.id))!.rowVersion!;
      expect(after).toBeGreaterThan(before);
    });

    it('4.7 concurrent customer acceptances resolve idempotently to one accepted state', async () => {
      const alice = await tokens.alice();
      const order = newOrder('Concurrent Accept');
      await seedOrderInQaReview(order);
      await approveAndDeliver(order.id);
      const results = await Promise.all(
        [0, 1, 2].map(() =>
          acceptPost(req(`/api/orders/${order.id}/accept`, { method: 'POST', headers: { authorization: `Bearer ${alice}` } }), ctx(order.id))
        )
      );
      for (const r of results) expect(r.status).toBe(200);
      const final = (await persistentDB.getOrder(order.id))!;
      expect(final.status).toBe('accepted');
      const accepted = new Set((await Promise.all(results.map((r) => r.json()))).map((j) => j.order.acceptedAt));
      expect(accepted.size).toBe(1);
    });

    it('4.8 delivery RPC rejects a stale expected version without partial writes', async () => {
      const order = newOrder('Stale Delivery');
      await seedOrderInQaReview(order);
      const file = await uploadStaffDeliverable(order.id);
      const review = await persistentDB.recordQaReview({
        orderId: order.id, file, reviewerId: ADMIN_ID, reviewerRole: 'admin', decision: 'approved', checklist: FULL_QA_CHECKLIST, notes: '',
      });
      const current = (await persistentDB.getOrder(order.id))!;
      await persistentDB.saveOrder({ ...current, assignedSpecialistName: 'bump' }, ORG_A); // someone else wrote
      await expect(
        persistentDB.deliverOrderWithQaApproval({
          order: OrderService.deliverOrder(current, { qaChecklistPassed: true }),
          fileId: file.id, qaReviewId: review.id, actorId: ENGINEER_ID, title: 't', verificationNotes: 'n',
        })
      ).rejects.toBeInstanceOf(OrderConcurrencyError);
      expect((await persistentDB.getDeliverables(order.id)).length).toBe(0);
      expect((await persistentDB.getOrder(order.id))?.status).toBe('qa_review');
    });
  });

  // ===========================================================================
  // 5. FILE CONTENT INTEGRITY
  // ===========================================================================
  describe('5. File content integrity', () => {
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    async function multipartUpload(token: string, orderId: string, bytes: Buffer, name: string, type: string, category?: string) {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(bytes)], { type }), name);
      if (category) form.append('category', category);
      return filesPost(
        new NextRequest(`${BASE}/api/orders/${orderId}/files`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form }),
        ctx(orderId)
      );
    }
    const download = (token: string, orderId: string, fileId: string) =>
      filesGet(req(`/api/orders/${orderId}/files?download=${fileId}`, { headers: { authorization: `Bearer ${token}` } }), ctx(orderId));

    it('5.1 genuine multipart upload round-trips the original bytes; SHA-256 is recomputed on download', async () => {
      const alice = await tokens.alice();
      const order = newOrder('Multipart RT');
      await persistentDB.saveOrder(order, ORG_A);
      const up = await multipartUpload(alice, order.id, PNG, 'logo.png', 'image/png');
      expect(up.status).toBe(200);
      const { file } = await up.json();
      expect(file.sha256Hash).toBe(crypto.createHash('sha256').update(PNG).digest('hex'));
      expect(file.storagePath).toBeUndefined();

      const dl = await download(alice, order.id, file.id);
      expect(dl.status).toBe(200);
      const bytes = Buffer.from(await dl.arrayBuffer());
      expect(bytes.equals(PNG)).toBe(true);
      expect(dl.headers.get('x-content-sha256')).toBe(file.sha256Hash);
      expect(dl.headers.get('x-content-type-options')).toBe('nosniff');
      expect(dl.headers.get('content-disposition')).toMatch(/^attachment;/);
    });

    it('5.2 corrupted stored bytes are never served (409) and are audited', async () => {
      const alice = await tokens.alice();
      const order = newOrder('Corrupt DL');
      await persistentDB.saveOrder(order, ORG_A);
      const { file } = await (await multipartUpload(alice, order.id, PNG, 'logo.png', 'image/png')).json();
      const stored = (await persistentDB.getOrderFile(order.id, file.id))!;
      await tamperStorage(stored.storagePath, Buffer.concat([PNG, Buffer.from('extra')]));

      const dl = await download(alice, order.id, file.id);
      expect(dl.status).toBe(409);
      const logs = await persistentDB.listAuditLogs();
      expect(logs.some((l) => l.action === 'FILE_INTEGRITY_FAILURE' && l.entityId === file.id)).toBe(true);
    });

    it('5.3 a same-size substitution with different content is detected by digest, not size', async () => {
      const alice = await tokens.alice();
      const order = newOrder('Same Size');
      await persistentDB.saveOrder(order, ORG_A);
      const { file } = await (await multipartUpload(alice, order.id, PNG, 'logo.png', 'image/png')).json();
      const stored = (await persistentDB.getOrderFile(order.id, file.id))!;
      const swapped = Buffer.from(PNG);
      swapped[swapped.length - 1] ^= 0xff;
      await tamperStorage(stored.storagePath, swapped);
      expect((await download(alice, order.id, file.id)).status).toBe(409);
    });

    it('5.4 missing stored object returns 410, unknown/foreign ids return 404', async () => {
      const alice = await tokens.alice();
      const order = newOrder('Missing DL');
      await persistentDB.saveOrder(order, ORG_A);
      const fileCode = `file_${crypto.randomBytes(8).toString('hex')}`;
      await asRole(
        'service_role',
        `INSERT INTO public.order_files (file_code, order_id, uploaded_by, file_name, file_size_bytes, mime_type,
           sha256_hash, storage_path, file_category, payload_json)
         VALUES ($1, $2, $3, 'gone.png', 10, 'image/png', $4, $5, 'client_asset', '{}'::jsonb)`,
        [fileCode, toDeterministicUuid(`order:${order.id}`), CUSTOMER_A_ID, 'e'.repeat(64), `orders/${order.id}/client_assets/${fileCode}_gone.png`]
      );
      expect((await download(alice, order.id, fileCode)).status).toBe(410);
      expect((await download(alice, order.id, 'file_doesnotexist')).status).toBe(404);
      expect((await download(alice, order.id, "x' OR 1=1 --")).status).toBe(404);
    });

    it('5.5 oversized uploads are refused before buffering (413)', async () => {
      const alice = await tokens.alice();
      const order = newOrder('Oversize');
      await persistentDB.saveOrder(order, ORG_A);
      const big = Buffer.alloc(25 * 1024 * 1024 + 1);
      PNG.copy(big);
      const res = await multipartUpload(alice, order.id, big, 'huge.png', 'image/png');
      expect(res.status).toBe(413);
      const declared = await filesPost(
        new NextRequest(`${BASE}/api/orders/${order.id}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${alice}`, 'content-type': 'application/json', 'content-length': String(40 * 1024 * 1024) },
          body: JSON.stringify({ fileName: 'a.png' }),
        }),
        ctx(order.id)
      );
      expect(declared.status).toBe(413);
      expect((await persistentDB.getFiles(order.id)).length).toBe(0);
    });

    it('5.6 hostile SVG content is rejected; a plain SVG is accepted and downloaded as an inert attachment', async () => {
      const hostile = [
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>x</text></a></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript&#58;alert(1)"><text>x</text></a></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>x</div></foreignObject></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://tracker.example/p.png"/></svg>',
        '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://x.example/a.css);</style></svg>',
        '<html><svg></svg></html>',
      ];
      for (const s of hostile) {
        expect(inspectSvg(Buffer.from(s)).isValid, s).toBe(false);
      }
      const plain = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><rect width="10" height="10" fill="url(#g)"/><use href="#g"/></svg>'
      );
      expect(inspectSvg(plain).isValid).toBe(true);

      const alice = await tokens.alice();
      const order = newOrder('SVG Serve');
      await persistentDB.saveOrder(order, ORG_A);
      const bad = await multipartUpload(alice, order.id, Buffer.from(hostile[1]), 'evil.svg', 'image/svg+xml');
      expect(bad.status).toBe(400);
      const ok = await multipartUpload(alice, order.id, plain, 'logo.svg', 'image/svg+xml');
      expect(ok.status).toBe(200);
      const { file } = await ok.json();
      const dl = await download(alice, order.id, file.id);
      expect(dl.status).toBe(200);
      expect(dl.headers.get('content-type')).toBe('application/octet-stream');
      expect(dl.headers.get('content-security-policy')).toMatch(/sandbox/);
      expect(dl.headers.get('content-disposition')).toMatch(/^attachment;/);
    });

    it('5.7 category-specific storage paths; unsafe names and unknown categories are refused', async () => {
      const alice = await tokens.alice();
      const engineer = await tokens.engineer();
      const order = newOrder('Paths');
      await seedOrderInQaReview(order);

      const custUp = await (await multipartUpload(alice, order.id, PNG, 'my logo (final).png', 'image/png', 'deliverable')).json();
      const custStored = (await persistentDB.getOrderFile(order.id, custUp.file.id))!;
      expect(custStored.category).toBe('client_asset'); // customers cannot self-label deliverables
      expect(custStored.storagePath).toMatch(new RegExp(`^orders/${order.id}/client_assets/file_[0-9a-f]+_my_logo_final_.png$`));

      const staffUp = await (await multipartUpload(engineer, order.id, PDF_BYTES, 'pack.pdf', 'application/pdf', 'deliverable')).json();
      const staffStored = (await persistentDB.getOrderFile(order.id, staffUp.file.id))!;
      expect(staffStored.storagePath).toMatch(new RegExp(`^orders/${order.id}/deliverables/`));

      expect((await multipartUpload(engineer, order.id, PDF_BYTES, 'pack.pdf', 'application/pdf', 'evil')).status).toBe(400);
      expect((await multipartUpload(alice, order.id, PNG, '../../etc/x.png', 'image/png')).status).toBe(400);
      expect(() => buildStoragePath('../x', 'client_asset', 'file_1', 'a.png')).toThrow();
    });

    it('5.8 customers cannot see or download staff deliverables until they are actually delivered', async () => {
      const alice = await tokens.alice();
      const order = newOrder('Visibility');
      await seedOrderInQaReview(order);
      const wip = await uploadStaffDeliverable(order.id);

      const list = await (await filesGet(req(`/api/orders/${order.id}/files`, { headers: { authorization: `Bearer ${alice}` } }), ctx(order.id))).json();
      expect(list.files.find((f: any) => f.id === wip.id)).toBeUndefined();
      expect((await download(alice, order.id, wip.id)).status).toBe(404);

      await approveAndDeliver(order.id, { file: wip });
      const dl = await download(alice, order.id, wip.id);
      expect(dl.status).toBe(200);
      expect(Buffer.from(await dl.arrayBuffer()).equals(PDF_BYTES)).toBe(true);
    });
  });

  // ===========================================================================
  // 6. CUSTOMER-FACING ACCURACY
  // ===========================================================================
  describe('6. Customer-facing accuracy', () => {
    it('6.1 intake uses the authenticated account email for customers (never a user id or a spoofed value)', async () => {
      const alice = await tokens.alice();
      const order = newOrder('Email Truth');
      await persistentDB.saveOrder(order, ORG_A);
      const res = await intakePost(
        req(`/api/orders/${order.id}/intake`, {
          method: 'POST',
          headers: { authorization: `Bearer ${alice}` },
          body: { businessName: 'Email Truth', contactEmail: CUSTOMER_A_ID, targetAudience: 'x', contactWhatsApp: '017' },
        }),
        ctx(order.id)
      );
      expect(res.status).toBe(200);
      const intake = await persistentDB.getIntake(order.id);
      expect(intake?.contactEmail).toBe('alice@dhakaheritage.bd');
    });

    it('6.2 deliverables API shows customers only genuinely delivered items, without internal storage paths', async () => {
      const alice = await tokens.alice();
      const admin = await tokens.admin();
      const order = newOrder('Deliverable View');
      await seedOrderInQaReview(order);
      await uploadStaffDeliverable(order.id, PDF_BYTES, 'draft.pdf'); // never delivered
      const { file } = await approveAndDeliver(order.id);

      const cust = await (await deliverablesGet(req(`/api/orders/${order.id}/deliverables`, { headers: { authorization: `Bearer ${alice}` } }), ctx(order.id))).json();
      expect(cust.deliverables.length).toBe(1);
      expect(cust.deliverables[0].storageBucketPath).toBeUndefined();
      expect(cust.files.map((f: any) => f.id)).toEqual([file.id]);
      expect(JSON.stringify(cust)).not.toMatch(/\/(client_assets|deliverables)\//);
      expect(cust.qaReviews).toEqual([]);

      const staff = await (await deliverablesGet(req(`/api/orders/${order.id}/deliverables`, { headers: { authorization: `Bearer ${admin}` } }), ctx(order.id))).json();
      expect(staff.files.length).toBe(2);
      expect(staff.qaReviews.length).toBe(1);
    });

    it('6.3 customer pages carry no unsupported generic promises or id-as-email fallbacks', () => {
      const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
      const workspace = read('src/app/dashboard/orders/[id]/page.tsx');
      expect(workspace).not.toMatch(/order\?\.customerUserId \|\|/);
      expect(workspace).not.toMatch(/Includes admin role verification and post-sale detailed audit report/);
      expect(workspace).not.toMatch(/Handover evidence pack is ready/);
      expect(workspace).not.toMatch(/\{f\.storagePath\}|\{d\.storageBucketPath\}/);
      const how = read('src/app/how-it-works/page.tsx');
      expect(how).not.toMatch(/posts your handover\s+package alongside our complimentary/);
      expect(how).not.toMatch(/7-day price guarantee/);
    });
  });

  // ===========================================================================
  // 7. INCIDENTAL: BUSINESS HOLIDAY PARSING
  // ===========================================================================
  it('7.1 BUSINESS_HOLIDAYS dates are actually parsed (regex previously matched literal "d")', () => {
    const prev = process.env.BUSINESS_HOLIDAYS;
    process.env.BUSINESS_HOLIDAYS = '2026-12-16, 2026-12-25,not-a-date';
    try {
      expect(getBusinessCalendar().holidays).toEqual(['2026-12-16', '2026-12-25']);
    } finally {
      if (prev === undefined) delete process.env.BUSINESS_HOLIDAYS;
      else process.env.BUSINESS_HOLIDAYS = prev;
    }
  });

  it('7.2 REST: authenticated clients cannot read QA reviews through PostgREST either', async () => {
    const res = await supabasePgliteFetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'}/rest/v1/order_qa_reviews?select=*`,
      { method: 'GET', headers: { Authorization: `Bearer mock-jwt-customer-${CUSTOMER_A_ID}`, apikey: 'test-anon-key' } }
    );
    expect(res.status).toBe(403);
  });
});

// Keep IntakeAndFileManager import used (type-level check that recordPrivateUpload rejects bad categories).
it('recordPrivateUpload rejects unknown categories', () => {
  expect(() => IntakeAndFileManager.recordPrivateUpload('ord_x', ADMIN_ID, 'a.pdf', 10, 'application/pdf', 'evil')).toThrow(/Invalid file category/);
});
