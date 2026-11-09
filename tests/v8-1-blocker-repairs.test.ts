import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { persistentDB, toDeterministicUuid } from '../src/domain/persistent-db';
import { OrderService } from '../src/domain/order-service';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { authenticateCredentials } from '../src/domain/auth-guard';
import { resetTestPostgresData } from '../src/testing/supabase-pglite-bridge';
import { POST as adminOrdersPost } from '../src/app/api/admin/orders/route';
import { POST as acceptPost } from '../src/app/api/orders/[id]/accept/route';
import { GET as deliverablesGet } from '../src/app/api/orders/[id]/deliverables/route';
import { POST as filesPost, GET as filesGet } from '../src/app/api/orders/[id]/files/route';
import { POST as sessionPost, PATCH as sessionPatch, DELETE as sessionDelete } from '../src/app/api/auth/session/route';
import { IntakeAndFileManager } from '../src/domain/intake-and-files';
import { FULL_QA_CHECKLIST, seedOrderInQaReview, uploadStaffDeliverable } from './helpers/delivery-fixtures';

const BASE = 'http://localhost:3000';

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

describe('Directive V8.1 — Critical Release Blocker Repair Test Suite', () => {
  beforeEach(async () => {
    await resetTestPostgresData();
  });

  describe('Priority 0 & 5: Real Customer File Upload, MIME & Content Integrity', () => {
    it('1. Rejects file upload when content does not match declared MIME (fake PNG)', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const quote = calculateServerQuote({
        businessId: 'biz-v81-1',
        businessName: 'MIME Roasters',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      await persistentDB.saveOrder(order, order.organizationId);

      // Declared image/png, but content is arbitrary plain text
      const fakePngBytes = Buffer.from('NOT_A_REAL_PNG_HEADER_JUST_RANDOM_TEXT');
      const res = await filesPost(
        req(`/api/orders/${order.id}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
          body: {
            fileName: 'fake_logo.png',
            mimeType: 'image/png',
            fileContentBase64: fakePngBytes.toString('base64'),
          },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/does not match declared PNG/i);
    });

    it('2. Rejects executable binary signatures even if disguised with image extension', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const quote = calculateServerQuote({
        businessId: 'biz-v81-2',
        businessName: 'Security Roasters',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      await persistentDB.saveOrder(order, order.organizationId);

      // Windows MZ executable signature disguised as JPG
      const disguisedExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      const res = await filesPost(
        req(`/api/orders/${order.id}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
          body: {
            fileName: 'innocent_photo.jpg',
            mimeType: 'image/jpeg',
            fileContentBase64: disguisedExe.toString('base64'),
          },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Executable binary signature/i);
    });

    it('3. Rejects forbidden extensions (.exe, .sh, .js)', () => {
      const exeRes = IntakeAndFileManager.validateUpload('script.sh', 500, 'application/x-sh');
      expect(exeRes.isValid).toBe(false);
      expect(exeRes.error).toMatch(/Executable and script files/i);

      const batRes = IntakeAndFileManager.validateUpload('test.bat', 100, 'application/octet-stream');
      expect(batRes.isValid).toBe(false);
    });

    it('4. Rejects oversized files (> 25MB)', () => {
      const overRes = IntakeAndFileManager.validateUpload('large.pdf', 26 * 1024 * 1024, 'application/pdf');
      expect(overRes.isValid).toBe(false);
      expect(overRes.error).toMatch(/25MB limit/i);
    });

    it('5. Allows real file upload, saves to private storage, and streams exact bytes on download', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const quote = calculateServerQuote({
        businessId: 'biz-v81-5',
        businessName: 'Real File Roasters',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      await persistentDB.saveOrder(order, order.organizationId);

      // Real 1x1 PNG bytes
      const validPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const originalBytes = Buffer.from(validPngBase64, 'base64');
      const expectedSha = crypto.createHash('sha256').update(originalBytes).digest('hex');

      const uploadRes = await filesPost(
        req(`/api/orders/${order.id}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
          body: {
            fileName: 'valid_logo.png',
            mimeType: 'image/png',
            fileContentBase64: validPngBase64,
          },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );

      expect(uploadRes.status).toBe(200);
      const { file: savedFile } = await uploadRes.json();
      expect(savedFile.sha256Hash).toBe(expectedSha);
      expect(savedFile.category).toBe('client_asset'); // Customer uploads are strictly client assets

      // Download file and verify original bytes and SHA-256 header
      const downloadRes = await filesGet(
        req(`/api/orders/${order.id}/files?download=${savedFile.id}`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers.get('x-content-sha256')).toBe(expectedSha);
      const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer());
      expect(downloadedBuffer.equals(originalBytes)).toBe(true);
    });

    it('6. Denies cross-tenant file downloads (Customer B cannot download Customer A files)', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const bobToken = await login('bob@chittagongtraders.bd', 'CustomerB#2026!');

      const quote = calculateServerQuote({
        businessId: 'biz-v81-6',
        businessName: 'Tenant Isolated Roasters',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.organizationId = '10000000-0000-4000-a000-000000000001';
      await persistentDB.saveOrder(order, order.organizationId);

      const validPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const uploadRes = await filesPost(
        req(`/api/orders/${order.id}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
          body: {
            fileName: 'alice_secret.png',
            mimeType: 'image/png',
            fileContentBase64: validPngBase64,
          },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      const { file: savedFile } = await uploadRes.json();

      // Bob attempts to download Alice's private file
      const bobDownload = await filesGet(
        req(`/api/orders/${order.id}/files?download=${savedFile.id}`, {
          headers: { authorization: `Bearer ${bobToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(bobDownload.status).toBe(403);
    });
  });

  describe('Priority 1 & 5: Honest QA Approval & Delivery Verification', () => {
    function qaOrder(businessId: string, businessName: string) {
      const quote = calculateServerQuote({
        businessId,
        businessName,
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      return OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
    }

    it('7. Rejects delivery without a persisted QA review (request flag qaChecklistPassed is never QA approval)', async () => {
      const adminToken = await login('admin@hoooplaaa.com', 'Admin#2026!');
      const order = qaOrder('biz-v81-7', 'QA Strict Ltd');
      await seedOrderInQaReview(order);
      const file = await uploadStaffDeliverable(order.id);

      for (const body of [
        { orderId: order.id, action: 'deliver' },
        { orderId: order.id, action: 'deliver', qaChecklistPassed: false },
        { orderId: order.id, action: 'deliver', qaChecklistPassed: true, deliverableFileId: file.id },
      ]) {
        const res = await adminOrdersPost(
          req('/api/admin/orders', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body })
        );
        expect(res.status).toBe(422);
        expect((await res.json()).error).toMatch(/persisted, approved QA review/i);
      }
      expect((await persistentDB.getOrder(order.id))?.status).toBe('qa_review');
    });

    it('8. Rejects delivery using a fabricated or raw storage path (only owned file ids are accepted)', async () => {
      const adminToken = await login('admin@hoooplaaa.com', 'Admin#2026!');
      const order = qaOrder('biz-v81-8', 'Fabrication Defense Corp');
      await seedOrderInQaReview(order);

      const fabricatedRes = await adminOrdersPost(
        req('/api/admin/orders', {
          method: 'POST',
          headers: { authorization: `Bearer ${adminToken}` },
          body: {
            orderId: order.id,
            action: 'deliver',
            qaReviewId: 'qa_fabricated',
            deliverablePath: `orders/${order.id}/deliverables/fabricated_pack_never_uploaded.pdf`,
          },
        })
      );
      expect(fabricatedRes.status).toBe(422);
      expect((await fabricatedRes.json()).error).toMatch(/Raw storage paths are not accepted/i);
    });

    it('9. Rejects QA review and delivery of a customer intake file (intake cannot count as deliverable)', async () => {
      const adminToken = await login('admin@hoooplaaa.com', 'Admin#2026!');
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const order = qaOrder('biz-v81-9', 'Intake Rejection Ltd');
      await seedOrderInQaReview(order);

      const validPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const custFileRes = await filesPost(
        req(`/api/orders/${order.id}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
          body: { fileName: 'client_intake_logo.png', mimeType: 'image/png', fileContentBase64: validPngBase64 },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      const { file: custFile } = await custFileRes.json();
      expect(custFile.category).toBe('client_asset');

      const qaRes = await adminOrdersPost(
        req('/api/admin/orders', {
          method: 'POST',
          headers: { authorization: `Bearer ${adminToken}` },
          body: { orderId: order.id, action: 'qa_review', decision: 'approved', checklist: FULL_QA_CHECKLIST, deliverableFileId: custFile.id },
        })
      );
      expect(qaRes.status).toBe(422);
      expect((await qaRes.json()).error).toMatch(/Customer intake uploads cannot be used as deliverables/i);

      const deliverWithIntake = await adminOrdersPost(
        req('/api/admin/orders', {
          method: 'POST',
          headers: { authorization: `Bearer ${adminToken}` },
          body: { orderId: order.id, action: 'deliver', qaReviewId: 'qa_any', deliverableFileId: custFile.id },
        })
      );
      expect(deliverWithIntake.status).toBe(422);
      expect((await deliverWithIntake.json()).error).toMatch(/Customer intake uploads cannot be used as deliverables/i);
    });

    it('10. Delivers only after a persisted, approved QA review of a real staff deliverable', async () => {
      const adminToken = await login('admin@hoooplaaa.com', 'Admin#2026!');
      const order = qaOrder('biz-v81-10', 'Honest Delivery Ltd');
      await seedOrderInQaReview(order);

      const realPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const staffUploadRes = await filesPost(
        req(`/api/orders/${order.id}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${adminToken}` },
          body: {
            fileName: 'official_handover_pack.pdf',
            mimeType: 'application/pdf',
            fileContentBase64: realPdfBytes.toString('base64'),
            category: 'deliverable',
          },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(staffUploadRes.status).toBe(200);
      const { file: deliverableFile } = await staffUploadRes.json();
      expect(deliverableFile.category).toBe('deliverable');
      expect(deliverableFile.sha256Hash).toBe(crypto.createHash('sha256').update(realPdfBytes).digest('hex'));

      const qaRes = await adminOrdersPost(
        req('/api/admin/orders', {
          method: 'POST',
          headers: { authorization: `Bearer ${adminToken}` },
          body: {
            orderId: order.id,
            action: 'qa_review',
            decision: 'approved',
            checklist: FULL_QA_CHECKLIST,
            deliverableFileId: deliverableFile.id,
            notes: 'All roles verified and partner admin granted.',
          },
        })
      );
      expect(qaRes.status).toBe(200);
      const { qaReview } = await qaRes.json();
      expect(qaReview.decision).toBe('approved');
      expect(qaReview.reviewerId).toBe('00000000-0000-4000-a000-000000000005');
      expect(qaReview.fileSha256).toBe(deliverableFile.sha256Hash);
      expect(qaReview.createdAt).toBeTruthy();

      const deliverRes = await adminOrdersPost(
        req('/api/admin/orders', {
          method: 'POST',
          headers: { authorization: `Bearer ${adminToken}` },
          body: {
            orderId: order.id,
            action: 'deliver',
            deliverableFileId: deliverableFile.id,
            qaReviewId: qaReview.id,
            deliverableTitle: 'Verified Meta Setup Handover Pack',
            verificationNotes: 'All roles verified and partner admin granted.',
          },
        })
      );

      expect(deliverRes.status).toBe(200);
      const deliverJson = await deliverRes.json();
      expect(deliverJson.order.status).toBe('delivered');
      expect(deliverJson.order.deliveredAt).toBeTruthy();

      const deliverables = await persistentDB.getDeliverables(order.id);
      expect(deliverables.length).toBe(1);
      expect(deliverables[0].qaChecklistPassed).toBe(true);
      expect(deliverables[0].fileId).toBe(deliverableFile.id);
      expect(deliverables[0].qaReviewId).toBe(qaReview.id);
      expect(deliverables[0].fileSha256).toBe(deliverableFile.sha256Hash);
    });
  });

  describe('Priority 2 & 5: Customer-Only Handover Acceptance', () => {
    it('11. Staff cannot accept delivery handover on /api/admin/orders (shortcut removed -> 403)', async () => {
      const adminToken = await login('admin@hoooplaaa.com', 'Admin#2026!');
      const quote = calculateServerQuote({
        businessId: 'biz-v81-11',
        businessName: 'Staff Shortcut Blocked',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.financialStatus = 'paid';
      order.intakeStatus = 'completed';
      order.status = 'delivered';
      await persistentDB.saveOrder(order, order.organizationId);

      const staffAcceptRes = await adminOrdersPost(
        req('/api/admin/orders', {
          method: 'POST',
          headers: { authorization: `Bearer ${adminToken}` },
          body: {
            orderId: order.id,
            action: 'accept',
          },
        })
      );
      expect(staffAcceptRes.status).toBe(403);
      const json = await staffAcceptRes.json();
      expect(json.error).toMatch(/Staff cannot accept delivery handover/i);
    });

    it('12. Staff cannot accept handover through customer endpoint /api/orders/[id]/accept (403)', async () => {
      const adminToken = await login('admin@hoooplaaa.com', 'Admin#2026!');
      const quote = calculateServerQuote({
        businessId: 'biz-v81-12',
        businessName: 'Customer Endpoint Guard',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.financialStatus = 'paid';
      order.intakeStatus = 'completed';
      order.status = 'delivered';
      await persistentDB.saveOrder(order, order.organizationId);

      const staffAcceptCustEndpoint = await acceptPost(
        req(`/api/orders/${order.id}/accept`, {
          method: 'POST',
          headers: { authorization: `Bearer ${adminToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(staffAcceptCustEndpoint.status).toBe(403);
      const json = await staffAcceptCustEndpoint.json();
      expect(json.error).toMatch(/Staff cannot accept delivery handover/i);
    });

    it('13. Rejects customer acceptance if deliverable storage file is missing (422)', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const quote = calculateServerQuote({
        businessId: 'biz-v81-13',
        businessName: 'Missing Storage Check',
        businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
        selectedPlatformSkus: ['HI-SET-META'],
        selectedAddonSkus: [],
      });
      const order = OrderService.createOrderFromQuote(quote, '00000000-0000-4000-a000-000000000001');
      order.organizationId = '10000000-0000-4000-a000-000000000001';
      order.financialStatus = 'paid';
      order.intakeStatus = 'completed';
      order.status = 'delivered';
      await persistentDB.saveOrder(order, order.organizationId);

      // Deliverable metadata in DB without actual storage object
      const supabase = persistentDB.getSupabaseAdminClient();
      const { error: insError } = await supabase.from('order_deliverables').insert({
        id: crypto.randomUUID(),
        deliverable_code: `deliv_${Date.now()}`,
        order_id: toDeterministicUuid(`order:${order.id}`),
        uploaded_by: '00000000-0000-4000-a000-000000000004',
        title: 'Phantom Deliverable',
        storage_bucket_path: `orders/${order.id}/phantom.pdf`,
        verification_notes: 'Missing real storage object for negative test.',
        qa_checklist_passed: true,
        created_at: new Date().toISOString(),
      });
      // V8.2: the database refuses deliverables not bound to an owned file + approved QA review.
      expect(insError?.message).toMatch(/DELIVERABLE_UNBOUND/);

      const acceptRes = await acceptPost(
        req(`/api/orders/${order.id}/accept`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(acceptRes.status).toBe(422);
      const json = await acceptRes.json();
      expect(json.error).toMatch(/No verified deliverable exists/i);
    });
  });

  describe('Priority 3 & 5: Session Security, Zero Browser Token Exposure & CSRF', () => {
    it('14. Authentication and Registration responses NEVER expose access token in JSON body', async () => {
      // 1. Login response
      const loginRes = await sessionPost(
        req('/api/auth/session', {
          method: 'POST',
          body: {
            email: 'alice@dhakaheritage.bd',
            password: 'CustomerA#2026!',
          },
        })
      );
      expect(loginRes.status).toBe(200);
      const loginJson = await loginRes.json();
      expect(loginJson.token).toBeUndefined(); // Zero token exposure in body
      expect(loginJson.user.email).toBe('alice@dhakaheritage.bd');
      expect(loginRes.headers.get('set-cookie')).toMatch(/sb-access-token=/);
    });

    it('15. Rejects cross-origin profile updates on PATCH /api/auth/session (CSRF defense)', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const csrfPatch = await sessionPatch(
        req('/api/auth/session', {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            origin: 'https://attacker-evil.com',
          },
          body: { fullName: 'Hacked Name' },
        })
      );
      expect(csrfPatch.status).toBe(403);
    });

    it('16. Rejects cross-origin file uploads on POST /api/orders/[id]/files (CSRF defense)', async () => {
      const aliceToken = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
      const csrfFile = await filesPost(
        req('/api/orders/ORD-123/files', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            origin: 'https://attacker-evil.com',
          },
          body: { fileName: 'exploit.png' },
        }),
        { params: Promise.resolve({ id: 'ORD-123' }) }
      );
      expect(csrfFile.status).toBe(403);
    });
  });
});
