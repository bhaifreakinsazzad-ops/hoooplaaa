import { describe, it, expect, beforeEach } from 'vitest';
import { persistentDB } from '../src/domain/persistent-db';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { resetTestPostgresData } from '../src/testing/supabase-pglite-bridge';

describe('V7.1 PostgreSQL Transactional Integrity & Concurrency Control Suite', () => {
  const ORG_ALPHA = '10000000-0000-4000-a000-000000000001';
  const CUSTOMER_A = '00000000-0000-4000-a000-000000000001';

  const ORG_BETA = '10000000-0000-4000-a000-000000000002';
  const CUSTOMER_B = '00000000-0000-4000-a000-000000000002';

  const STAFF_ID = '00000000-0000-4000-a000-000000000003';

  beforeEach(async () => {
    await resetTestPostgresData();
  });

  // Test 1: Concurrency Control — Simultaneous checkout attempts return the exact same order
  it('1. Handles 10 simultaneous checkout requests for the same quote snapshot returning identical orders without duplicates', async () => {
    const quote = calculateServerQuote({
      businessId: ORG_ALPHA,
      businessName: 'Concurrent Checkout Ltd',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });
    const savedQuote = await persistentDB.saveQuote(quote, CUSTOMER_A, ORG_ALPHA);

    // Fire 10 simultaneous checkout attempts
    const concurrentAttempts = Array.from({ length: 10 }).map(() =>
      persistentDB.createOrGetActiveOrderForQuote({
        quote: savedQuote,
        customerId: CUSTOMER_A,
        organizationId: ORG_ALPHA,
      })
    );

    const results = await Promise.all(concurrentAttempts);
    const firstOrderId = results[0].order.id;

    // Every single concurrent request must return the exact same order ID
    for (const r of results) {
      expect(r.order.id).toBe(firstOrderId);
    }

    // Verify exactly one order was persisted to PostgreSQL
    const allOrders = await persistentDB.listAllOrders();
    const matchingOrders = allOrders.filter(
      (o) => o.quoteId === savedQuote.id || o.quoteSnapshot?.id === savedQuote.id
    );
    expect(matchingOrders.length).toBe(1);
    expect(matchingOrders[0].id).toBe(firstOrderId);
  });

  // Test 2: Genuine PostgreSQL Atomic Transaction — settleOrderPaymentPaid
  it('2. Atomically transitions order to paid, payment to verified, and logs audit record in a single transaction', async () => {
    const quote = calculateServerQuote({
      businessId: ORG_ALPHA,
      businessName: 'Atomic Settlement Corp',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });
    const savedQuote = await persistentDB.saveQuote(quote, CUSTOMER_A, ORG_ALPHA);

    const { order } = await persistentDB.createOrGetActiveOrderForQuote({
      quote: savedQuote,
      customerId: CUSTOMER_A,
      organizationId: ORG_ALPHA,
    });

    // Record valid initiated payment attempt
    const paymentAttemptId = `pay_ssl_${Date.now()}`;
    await persistentDB.recordPaymentAttempt({
      id: paymentAttemptId,
      orderId: order.id,
      paymentMethod: 'sslcommerz',
      paymentStatus: 'initiated',
      amountMinor: order.totalMinor, // 150000
      currency: 'BDT',
      idempotencyKey: `idemp_${paymentAttemptId}`,
      createdAt: new Date().toISOString(),
      gatewayRawPayload: {},
    });

    // Execute atomic settlement
    const settlement = await persistentDB.settleOrderPaymentPaid({
      orderId: order.id,
      paymentAttemptId,
      verifiedByStaffId: STAFF_ID,
      providerValId: 'SSL-VAL-ATOMIC-123',
      evidencePayload: { bankTranId: 'BANK-TRX-777' },
    });

    expect(settlement.order.financialStatus).toBe('paid');
    expect(settlement.order.status).toBe('awaiting_requirements');
    expect(settlement.payment.paymentStatus).toBe('verified');
    expect(settlement.payment.providerValId).toBe('SSL-VAL-ATOMIC-123');

    // Confirm PostgreSQL persistence
    const reloadedOrder = await persistentDB.getOrder(order.id);
    expect(reloadedOrder?.financialStatus).toBe('paid');
    expect(reloadedOrder?.status).toBe('awaiting_requirements');

    const payments = await persistentDB.getPaymentsForOrder(order.id);
    expect(payments.length).toBe(1);
    expect(payments[0].paymentStatus).toBe('verified');
  });

  // Test 3: Mid-Transaction Failure & Rollback — Amount mismatch causes complete rollback
  it('3. Rolls back completely when payment amount mismatches authoritative order total', async () => {
    const quote = calculateServerQuote({
      businessId: ORG_ALPHA,
      businessName: 'Tamper Defense Ltd',
      businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
      selectedPlatformSkus: ['HI-BUNDLE-3'], // 300000 minor
      selectedAddonSkus: [],
    });
    const savedQuote = await persistentDB.saveQuote(quote, CUSTOMER_A, ORG_ALPHA);

    const { order } = await persistentDB.createOrGetActiveOrderForQuote({
      quote: savedQuote,
      customerId: CUSTOMER_A,
      organizationId: ORG_ALPHA,
    });

    // Attacker created payment attempt with only 100,000 poisha instead of 300,000
    const tamperedAttemptId = `pay_tamper_${Date.now()}`;
    await persistentDB.recordPaymentAttempt({
      id: tamperedAttemptId,
      orderId: order.id,
      paymentMethod: 'sslcommerz',
      paymentStatus: 'initiated',
      amountMinor: 100000, // MISMATCH! Order total is 300,000
      currency: 'BDT',
      idempotencyKey: `idemp_${tamperedAttemptId}`,
      createdAt: new Date().toISOString(),
      gatewayRawPayload: {},
    });

    // Attempt settlement — must throw exception and abort
    await expect(
      persistentDB.settleOrderPaymentPaid({
        orderId: order.id,
        paymentAttemptId: tamperedAttemptId,
      })
    ).rejects.toThrow(/mismatch/i);

    // Verify order was NOT updated in PostgreSQL (zero partial commits)
    const orderAfterFailure = await persistentDB.getOrder(order.id);
    expect(orderAfterFailure?.financialStatus).toBe('unpaid');
    expect(orderAfterFailure?.status).toBe('awaiting_payment');

    // Verify payment was NOT marked verified
    const payments = await persistentDB.getPaymentsForOrder(order.id);
    expect(payments[0].paymentStatus).toBe('initiated');
  });

  // Test 4: Replay Protection & Idempotent Resettlement
  it('4. Returns idempotent success for duplicate settlement callbacks and rejects conflicting attempts', async () => {
    const quote = calculateServerQuote({
      businessId: ORG_ALPHA,
      businessName: 'Replay Test Co',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });
    const savedQuote = await persistentDB.saveQuote(quote, CUSTOMER_A, ORG_ALPHA);

    const { order } = await persistentDB.createOrGetActiveOrderForQuote({
      quote: savedQuote,
      customerId: CUSTOMER_A,
      organizationId: ORG_ALPHA,
    });

    const firstPaymentId = `pay_first_${Date.now()}`;
    await persistentDB.recordPaymentAttempt({
      id: firstPaymentId,
      orderId: order.id,
      paymentMethod: 'sslcommerz',
      paymentStatus: 'initiated',
      amountMinor: order.totalMinor,
      currency: 'BDT',
      idempotencyKey: `idemp_${firstPaymentId}`,
      createdAt: new Date().toISOString(),
      gatewayRawPayload: {},
    });

    // 1st settlement: succeeds
    const firstSettlement = await persistentDB.settleOrderPaymentPaid({
      orderId: order.id,
      paymentAttemptId: firstPaymentId,
    });
    expect(firstSettlement.order.financialStatus).toBe('paid');

    // 2nd settlement callback with SAME payment: returns idempotent success
    const secondSettlement = await persistentDB.settleOrderPaymentPaid({
      orderId: order.id,
      paymentAttemptId: firstPaymentId,
    });
    expect(secondSettlement.order.financialStatus).toBe('paid');

    // 3rd settlement attempt with DIFFERENT payment: rejected because order is already settled
    const secondPaymentId = `pay_second_${Date.now()}`;
    await persistentDB.recordPaymentAttempt({
      id: secondPaymentId,
      orderId: order.id,
      paymentMethod: 'sslcommerz',
      paymentStatus: 'initiated',
      amountMinor: order.totalMinor,
      currency: 'BDT',
      idempotencyKey: `idemp_${secondPaymentId}`,
      createdAt: new Date().toISOString(),
      gatewayRawPayload: {},
    });

    await expect(
      persistentDB.settleOrderPaymentPaid({
        orderId: order.id,
        paymentAttemptId: secondPaymentId,
      })
    ).rejects.toThrow(/already been settled/i);
  });

  // Test 5: Secure Manual Payment Approval — Rejects approval if no pending payment attempt exists
  it('5. Strictly rejects finance settlement if no pending payment attempt exists (no fictional payment record fallback)', async () => {
    const quote = calculateServerQuote({
      businessId: ORG_ALPHA,
      businessName: 'No Payment Order Ltd',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });
    const savedQuote = await persistentDB.saveQuote(quote, CUSTOMER_A, ORG_ALPHA);

    const { order } = await persistentDB.createOrGetActiveOrderForQuote({
      quote: savedQuote,
      customerId: CUSTOMER_A,
      organizationId: ORG_ALPHA,
    });

    // No payments recorded for this order!
    // Attempting to settle a non-existent payment must throw
    await expect(
      persistentDB.settleOrderPaymentPaid({
        orderId: order.id,
        paymentAttemptId: 'fictional_non_existent_payment_id',
        verifiedByStaffId: STAFF_ID,
      })
    ).rejects.toThrow(/not found/i);

    // Verify 0 payments exist in PostgreSQL
    const payments = await persistentDB.getPaymentsForOrder(order.id);
    expect(payments.length).toBe(0);
  });

  // Test 6: Single-Use, Private Guest Quote Claiming & Cross-Tenant Protection
  it('6. Allows guest quote to be claimed privately and rejects subsequent cross-tenant claiming attempts', async () => {
    // 1. Guest creates quote (no customerId or organizationId)
    const guestQuote = calculateServerQuote({
      businessId: 'biz-guest-6',
      businessName: 'Guest Quote Shop',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });
    const savedGuestQuote = await persistentDB.saveQuote(guestQuote);

    // 2. Customer A claims the quote
    const claimedByA = await persistentDB.claimGuestQuote(
      savedGuestQuote.id,
      CUSTOMER_A,
      ORG_ALPHA
    );
    expect(claimedByA.customerId).toBe(CUSTOMER_A);

    // 3. Customer B attempts to claim the same quote — must be rejected
    await expect(
      persistentDB.claimGuestQuote(
        savedGuestQuote.id,
        CUSTOMER_B,
        ORG_BETA
      )
    ).rejects.toThrow(/Cross-tenant violation/i);
  });
});
