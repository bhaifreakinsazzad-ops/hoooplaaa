import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { OrderService } from '../src/domain/order-service';
import { persistentDB } from '../src/domain/persistent-db';
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
    const firstClaim = await persistentDB.claimUniquePaymentEvent({
      eventKey: `ssl:${uniqueValId}`,
      orderId: order.id,
      provider: 'sslcommerz',
      providerValId: uniqueValId,
      status: 'verified_paid',
      amountMinor: 150000,
      currency: 'BDT',
      evidencePayload: { val_id: uniqueValId },
    });
    expect(firstClaim.claimed).toBe(true);

    // Duplicate callback with same val_id must be rejected by SQL unique constraint
    const replayClaim = await persistentDB.claimUniquePaymentEvent({
      eventKey: `ssl:${uniqueValId}`,
      orderId: order.id,
      provider: 'sslcommerz',
      providerValId: uniqueValId,
      status: 'verified_paid',
      amountMinor: 150000,
      currency: 'BDT',
      evidencePayload: { val_id: uniqueValId },
    });
    expect(replayClaim.claimed).toBe(false);
    expect(replayClaim.reason).toContain('already processed');
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
});
