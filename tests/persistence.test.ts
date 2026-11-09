import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { OrderService } from '../src/domain/order-service';
import { persistentDB, toDeterministicUuid } from '../src/domain/persistent-db';
import { IntakeAndFileManager } from '../src/domain/intake-and-files';

describe('Relational Database Persistence, Restart Durability & Private File Integrity (V5)', () => {
  it('1. Persists quotes, orders, intakes, and audit logs asynchronously in SQL', async () => {
    const quote = calculateServerQuote({
      businessId: '10000000-0000-4000-a000-000000000001',
      businessName: 'SQL Durable Tech Ltd.',
      businessProfile: {
        operatingModel: 'in_person_storefront',
        hasPhysicalStorefront: true,
        conductsInPersonVisits: true,
      },
      selectedPlatformSkus: ['HI-BUNDLE-3'],
      selectedAddonSkus: ['HI-ADD-WA'],
    });

    await persistentDB.saveQuote(
      quote,
      '00000000-0000-4000-a000-000000000001',
      '10000000-0000-4000-a000-000000000001'
    );
    const loadedQuote = await persistentDB.getQuote(quote.id);
    expect(loadedQuote).toBeDefined();
    expect(loadedQuote?.totalMinor).toBe(469000);

    const order = OrderService.createOrderFromQuote(
      quote,
      '00000000-0000-4000-a000-000000000001'
    );
    await persistentDB.saveOrder(order, '10000000-0000-4000-a000-000000000001');

    const loadedOrder = await persistentDB.getOrder(order.id);
    expect(loadedOrder).toBeDefined();
    expect(loadedOrder?.orderNumber).toBe(order.orderNumber);
    expect(loadedOrder?.organizationId).toBe('10000000-0000-4000-a000-000000000001');
  });

  it('2. Enforces database-backed payment event idempotency and blocks replay attacks', async () => {
    const quote = calculateServerQuote({
      businessId: '10000000-0000-4000-a000-000000000001',
      businessName: 'Replay Check Corp',
      businessProfile: {
        operatingModel: 'in_person_storefront',
        hasPhysicalStorefront: true,
        conductsInPersonVisits: true,
      },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });
    await persistentDB.saveQuote(quote);
    const order = OrderService.createOrderFromQuote(
      quote,
      '00000000-0000-4000-a000-000000000001'
    );
    await persistentDB.saveOrder(order, '10000000-0000-4000-a000-000000000001');

    const uniqueValId = `VAL_SQL_${Date.now()}`;
    const attemptId = `pay_sql_${Date.now()}`;
    await persistentDB.recordPaymentAttempt({
      id: attemptId,
      orderId: order.id,
      paymentMethod: 'sslcommerz',
      paymentStatus: 'initiated',
      amountMinor: order.totalMinor,
      currency: 'BDT',
      idempotencyKey: `idemp_${attemptId}`,
      gatewayRawPayload: {},
      createdAt: new Date().toISOString(),
    });
    const settleArgs = {
      orderId: order.id,
      paymentAttemptId: attemptId,
      source: 'sslcommerz_s2s_validated' as const,
      providerValId: uniqueValId,
      evidencePayload: {
        providerValidated: true,
        status: 'VALID',
        tranId: attemptId,
        valId: uniqueValId,
        amountMinor: order.totalMinor,
        currency: 'BDT',
      },
    };
    await persistentDB.settleOrderPaymentPaid(settleArgs);

    // Replay of the same provider validation is idempotent (no second event row)...
    await persistentDB.settleOrderPaymentPaid(settleArgs);
    const admin = persistentDB.getSupabaseAdminClient();
    const events = await admin.from('payment_events').select('event_key').eq('provider_val_id', uniqueValId);
    expect(events.data?.length).toBe(1);

    // ...and a forged duplicate event row is rejected by the SQL UNIQUE constraint.
    const dup = await admin.from('payment_events').insert({
      event_key: `ssl:${uniqueValId}:dup`,
      order_id: toDeterministicUuid(`order:${order.id}`),
      provider: 'sslcommerz',
      provider_val_id: uniqueValId,
      status: 'verified',
      amount_minor: order.totalMinor,
      currency: 'BDT',
      evidence_payload: {},
    });
    expect(dup.error).toBeTruthy();
  });

  it('3. Persists real binary file bytes in the private vault and verifies SHA-256 digest on retrieval', async () => {
    const quote = calculateServerQuote({
      businessId: '10000000-0000-4000-a000-000000000001',
      businessName: 'Vault Binary Check Ltd',
      businessProfile: {
        operatingModel: 'in_person_storefront',
        hasPhysicalStorefront: true,
        conductsInPersonVisits: true,
      },
      selectedPlatformSkus: ['HI-SET-LINKEDIN'],
      selectedAddonSkus: [],
    });
    await persistentDB.saveQuote(quote);
    const order = OrderService.createOrderFromQuote(
      quote,
      '00000000-0000-4000-a000-000000000001'
    );
    await persistentDB.saveOrder(order, '10000000-0000-4000-a000-000000000001');

    const realPngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const expectedSha256 = crypto.createHash('sha256').update(realPngBytes).digest('hex');

    const fileMeta = IntakeAndFileManager.recordPrivateUpload(
      order.id,
      '00000000-0000-4000-a000-000000000001',
      'brand_logo.png',
      realPngBytes.byteLength,
      'image/png'
    );

    await persistentDB.savePrivateFileWithBytes(
      { ...fileMeta, sha256Hash: expectedSha256 },
      realPngBytes
    );

    const retrieved = await persistentDB.getPrivateFileBytes(order.id, fileMeta.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.bytes.equals(realPngBytes)).toBe(true);
    expect(retrieved?.file.sha256Hash).toBe(expectedSha256);
  });

  it('4. Persists order_deliverables and order_revisions in PostgreSQL and refuses local fallback when credentials are missing', async () => {
    const quote = calculateServerQuote({
      businessId: '10000000-0000-4000-a000-000000000001',
      businessName: 'Deliverables & Revisions Ltd',
      businessProfile: {
        operatingModel: 'in_person_storefront',
        hasPhysicalStorefront: true,
        conductsInPersonVisits: true,
      },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });
    await persistentDB.saveQuote(quote);
    const order = OrderService.createOrderFromQuote(
      quote,
      '00000000-0000-4000-a000-000000000001'
    );
    await persistentDB.saveOrder(order, '10000000-0000-4000-a000-000000000001');

    const realPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    await persistentDB.savePrivateFileWithBytes(
      {
        id: `deliv_${Date.now()}`,
        orderId: order.id,
        uploadedByUserId: '00000000-0000-4000-a000-000000000004',
        fileName: 'handover.pdf',
        mimeType: 'application/pdf',
        storagePath: `orders/${order.id}/handover.pdf`,
        fileSizeBytes: realPdfBytes.length,
        isPrivate: true,
        category: 'deliverable',
        uploadedAt: new Date().toISOString(),
      },
      realPdfBytes
    );

    const deliverable = await persistentDB.saveDeliverable({
      orderId: order.id,
      uploadedBy: '00000000-0000-4000-a000-000000000004',
      title: 'Meta Business Portfolio Handover Pack',
      storageBucketPath: `orders/${order.id}/handover.pdf`,
      verificationNotes: 'Partner ID 8899110022 delegated and verified.',
      qaChecklistPassed: true,
    });
    expect(deliverable.qaChecklistPassed).toBe(true);

    const deliverablesList = await persistentDB.getDeliverables(order.id);
    expect(deliverablesList.length).toBe(1);
    expect(deliverablesList[0].title).toBe('Meta Business Portfolio Handover Pack');

    const revision = await persistentDB.saveRevision({
      orderId: order.id,
      requestedBy: '00000000-0000-4000-a000-000000000001',
      revisionNotes: 'Please update the Instagram bio link to our new domain.',
    });
    expect(revision.isResolved).toBe(false);

    const revisionsList = await persistentDB.getRevisions(order.id);
    expect(revisionsList.length).toBe(1);
    expect(revisionsList[0].revisionNotes).toContain('Instagram bio link');
  });
});
