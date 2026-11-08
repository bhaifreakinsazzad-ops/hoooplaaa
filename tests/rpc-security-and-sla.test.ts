import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { persistentDB } from '@/domain/persistent-db';
import { resetTestPostgresData, supabasePgliteFetch } from '../src/testing/supabase-pglite-bridge';
import {
  OrderService,
  addBusinessDays,
  getBusinessCalendar,
  getServiceTurnaroundBusinessDays,
} from '@/domain/order-service';
import { QuoteSnapshot } from '@/domain/types';
import { hashGuestClaimToken } from '@/domain/guest-claim';

describe('V7.2 Privileged RPC Lockdown, Pricing Integrity & Service-Specific SLA Suite', () => {
  const TEST_ORG_ALPHA = '10000000-0000-4000-a000-000000000001';
  const TEST_ORG_BETA = '10000000-0000-4000-a000-000000000002';
  const TEST_CUSTOMER_ALPHA = '00000000-0000-4000-a000-000000000001';
  const TEST_CUSTOMER_BETA = '00000000-0000-4000-a000-000000000002';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aqmyqezuoscpgqwtvblu.supabase.co';

  beforeAll(async () => {
    await resetTestPostgresData();
  });

  afterAll(async () => {
    await resetTestPostgresData();
  });

  // ============================================================================
  // PRIORITY 0: PRIVILEGED RPC FUNCTION LOCKDOWN (NEGATIVE SECURITY TESTS)
  // ============================================================================

  it('1. Direct unauthenticated / anon PostgREST call to settle_order_payment_paid is rejected with HTTP 403 Forbidden', async () => {
    const res = await supabasePgliteFetch(`${supabaseUrl}/rest/v1/rpc/settle_order_payment_paid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: 'test-anon-key',
      },
      body: JSON.stringify({
        p_order_id: 'ord_fake_id',
        p_payment_attempt_code: 'pay_fake',
        p_settlement_source: 'finance_manual',
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('42501');
    expect(body.message).toContain('permission denied for function settle_order_payment_paid');
  });

  it('2. Direct authenticated customer PostgREST call to convert_quote_to_active_order is rejected with HTTP 403 Forbidden', async () => {
    const res = await supabasePgliteFetch(`${supabaseUrl}/rest/v1/rpc/convert_quote_to_active_order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer mock-jwt-customer-${TEST_CUSTOMER_ALPHA}`,
      },
      body: JSON.stringify({
        p_order_id: crypto.randomUUID(),
        p_quote_id: 'QUO-FAKE-001',
        p_customer_id: TEST_CUSTOMER_ALPHA,
        p_organization_id: TEST_ORG_ALPHA,
        p_order_code: 'ord_fake',
        p_order_number: 'HI-FAKE',
        p_payload_json: {},
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('42501');
    expect(body.message).toContain('permission denied for function convert_quote_to_active_order');
  });

  it('3. Direct authenticated customer PostgREST call to claim_guest_quote is rejected with HTTP 403 Forbidden', async () => {
    const res = await supabasePgliteFetch(`${supabaseUrl}/rest/v1/rpc/claim_guest_quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer mock-jwt-customer-${TEST_CUSTOMER_BETA}`,
      },
      body: JSON.stringify({
        p_quote_id: 'QUO-FAKE-002',
        p_customer_id: TEST_CUSTOMER_BETA,
        p_organization_id: TEST_ORG_BETA,
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('42501');
    expect(body.message).toContain('permission denied for function claim_guest_quote');
  });

  // ============================================================================
  // PRIORITY 1: PREVENT CLIENT-SIDE PRICE & FINANCIAL RECORD MANIPULATION
  // ============================================================================

  it('4. Direct customer / anon INSERT on quotes table with fabricated price is rejected with HTTP 403 Forbidden', async () => {
    const res = await supabasePgliteFetch(`${supabaseUrl}/rest/v1/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer mock-jwt-customer-${TEST_CUSTOMER_ALPHA}`,
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        quote_code: 'QUO-HACK-001',
        business_name: 'Hacked Business',
        selected_items: [],
        subtotal_minor: 100, // ৳1 hack
        total_minor: 100,
        currency: 'BDT',
        eligibility_snapshot: {},
        status: 'priced',
        quote_hash: 'fake_hash',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        payload_json: {},
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('42501');
    expect(body.message).toContain('permission denied for table quotes');
  });

  it('5. Direct customer / anon INSERT on orders table with fabricated status is rejected with HTTP 403 Forbidden', async () => {
    const res = await supabasePgliteFetch(`${supabaseUrl}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer mock-jwt-customer-${TEST_CUSTOMER_ALPHA}`,
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        order_code: 'ord_hacked_order',
        order_number: 'HI-2026-HACK',
        organization_id: TEST_ORG_ALPHA,
        customer_id: TEST_CUSTOMER_ALPHA,
        quote_id: crypto.randomUUID(),
        order_status: 'ready_for_fulfillment',
        financial_status: 'paid', // Fake paid status
        intake_status: 'completed',
        total_minor: 100,
        currency: 'BDT',
        quote_snapshot: [],
        payload_json: {},
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('42501');
    expect(body.message).toContain('permission denied for table orders');
  });

  // ============================================================================
  // PRIORITY 3: SINGLE-USE CAPABILITY TOKEN FOR GUEST QUOTE CLAIMING
  // ============================================================================

  it('6. Guest quote claiming strictly requires the valid single-use capability and prevents unauthorized takeover', async () => {
    const rawClaimToken = crypto.randomBytes(32).toString('base64url');

    const guestQuote: QuoteSnapshot = {
      id: `QUO-GUEST-${Date.now()}`,
      businessId: 'biz_guest_retail',
      businessName: 'Dhaka Craft Workshop',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      ruleVersion: '2026-11-08-v1',
      termsHash: 'guest_terms_hash',
      items: [
        {
          sku: 'HI-SET-META',
          name: 'Meta Business Setup',
          nameBn: 'মেটা বিজনেস সেটআপ',
          unitPriceMinor: 150000,
          quantity: 1,
          lineTotalMinor: 150000,
          billingPeriod: 'one_time',
          inclusionsSnapshot: ['Facebook page setup'],
          exclusionsSnapshot: ['Ad spend'],
          deliveryTarget: '1–2 business days',
        },
      ],
      subtotalMinor: 150000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 150000,
      currency: 'BDT',
      eligibility: { isEligible: true, canSelfCheckout: true, flags: [] },
      status: 'priced',
    };

    // Save authoritative guest quote (unassigned customer/org); only the HASH of the capability is stored
    await persistentDB.saveQuote(guestQuote, undefined, undefined, {
      tokenHash: hashGuestClaimToken(rawClaimToken),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });

    // Attempt 1: Unauthorized customer attempts to claim quote with a wrong token -> FAILS
    await expect(
      persistentDB.claimGuestQuote(guestQuote.id, TEST_CUSTOMER_BETA, TEST_ORG_BETA, 'wrong_token_value')
    ).rejects.toThrow(/Unauthorized: invalid guest quote claim/i);

    // Attempt 2: Authorized claiming with correct single-use capability token -> SUCCEEDS
    const claimedQuote = await persistentDB.claimGuestQuote(
      guestQuote.id,
      TEST_CUSTOMER_ALPHA,
      TEST_ORG_ALPHA,
      rawClaimToken
    );
    expect(claimedQuote.customerId).toBe(TEST_CUSTOMER_ALPHA);
    expect(claimedQuote.organizationId).toBe(TEST_ORG_ALPHA);

    // Attempt 3: Single-use replay protection: token was cleared, another customer cannot re-claim
    await expect(
      persistentDB.claimGuestQuote(guestQuote.id, TEST_CUSTOMER_BETA, TEST_ORG_BETA, rawClaimToken)
    ).rejects.toThrow(/Cross-tenant violation/i);
  });

  // ============================================================================
  // PRIORITY 3: DYNAMIC SERVICE-SPECIFIC BUSINESS-DAY SLA CALCULATIONS
  // ============================================================================

  it('7. Calculates exact service-specific turnaround business days across SKUs', () => {
    // LinkedIn only -> 1 business day
    expect(getServiceTurnaroundBusinessDays([{ sku: 'HI-SET-LINKEDIN' }])).toBe(1);

    // Meta Setup only -> 2 business days
    expect(getServiceTurnaroundBusinessDays([{ sku: 'HI-SET-META' }])).toBe(2);

    // Google Business Setup only -> 2 business days
    expect(getServiceTurnaroundBusinessDays([{ sku: 'HI-SET-GOOGLE' }])).toBe(2);

    // Hero Bundle-3 -> 4 business days
    expect(getServiceTurnaroundBusinessDays([{ sku: 'HI-BUNDLE-3' }])).toBe(4);

    // Mixed Setup (Meta + LinkedIn) -> max(2, 1) = 2 business days
    expect(
      getServiceTurnaroundBusinessDays([{ sku: 'HI-SET-META' }, { sku: 'HI-SET-LINKEDIN' }])
    ).toBe(2);

    // Bundle-3 + WhatsApp Addon -> max(4, 2) = 4 business days
    expect(
      getServiceTurnaroundBusinessDays([{ sku: 'HI-BUNDLE-3' }, { sku: 'HI-ADD-WA' }])
    ).toBe(4);
  });

  it('8. Business day calculator follows the configurable Asia/Dhaka calendar (policy, not a silent Sat/Sun assumption)', () => {
    const satSunPolicy = { ...getBusinessCalendar(), weekendDays: [0, 6], holidays: [] as string[] };
    // Friday 2026-11-13 10:00 Asia/Dhaka (= 04:00Z)
    const friday = new Date('2026-11-13T04:00:00.000Z');

    // Sat/Sun policy: 1 BD -> Monday 16th, 2 BD -> Tuesday 17th, 4 BD -> Thursday 19th (same local time)
    expect(addBusinessDays(friday, 1, satSunPolicy).toISOString()).toBe('2026-11-16T04:00:00.000Z');
    expect(addBusinessDays(friday, 2, satSunPolicy).toISOString()).toBe('2026-11-17T04:00:00.000Z');
    expect(addBusinessDays(friday, 4, satSunPolicy).toISOString()).toBe('2026-11-19T04:00:00.000Z');

    // Default provisional policy (Friday/Saturday weekend): Friday start rolls to Sunday 15th 09:00 local
    // (03:00Z), then 1 BD -> Monday 16th 09:00 local.
    const fri = { ...getBusinessCalendar(), weekendDays: [5, 6], holidays: [] as string[] };
    expect(addBusinessDays(friday, 1, fri).toISOString()).toBe('2026-11-16T03:00:00.000Z');
    // After cutoff (17:00 local) on Thursday 12th -> clock starts Sunday 15th opening
    const thursdayEvening = new Date('2026-11-12T12:30:00.000Z'); // 18:30 local
    expect(addBusinessDays(thursdayEvening, 1, fri).toISOString()).toBe('2026-11-16T03:00:00.000Z');
    // Holiday skipping
    const withHoliday = { ...fri, holidays: ['2026-11-16'] };
    expect(addBusinessDays(friday, 1, withHoliday).toISOString()).toBe('2026-11-17T03:00:00.000Z');
  });

  it('9. SLA clock triggers ONLY when BOTH payment is verified AND intake requirements are completed', async () => {
    const quote: QuoteSnapshot = {
      id: `QUO-SLA-${Date.now()}`,
      businessId: TEST_ORG_ALPHA,
      businessName: 'Dhaka Roasters SLA Test',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      ruleVersion: '2026-11-08-v1',
      termsHash: 'sla_terms_hash',
      items: [
        {
          sku: 'HI-BUNDLE-3', // 4 business days turnaround
          name: 'Complete 3-Platform Business Setup (Hero Offer)',
          nameBn: 'কমপ্লিট ৩-প্ল্যাটফর্ম বিজনেস সেটআপ',
          unitPriceMinor: 300000,
          quantity: 1,
          lineTotalMinor: 300000,
          billingPeriod: 'one_time',
          inclusionsSnapshot: ['Meta + Google + LinkedIn'],
          exclusionsSnapshot: ['Ad budget'],
          deliveryTarget: '2–4 business days',
        },
      ],
      subtotalMinor: 300000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 300000,
      currency: 'BDT',
      eligibility: { isEligible: true, canSelfCheckout: true, flags: [] },
      status: 'priced',
      customerId: TEST_CUSTOMER_ALPHA,
      organizationId: TEST_ORG_ALPHA,
    };

    await persistentDB.saveQuote(quote, TEST_CUSTOMER_ALPHA, TEST_ORG_ALPHA);

    const { order } = await persistentDB.createOrGetActiveOrderForQuote({
      quote,
      customerId: TEST_CUSTOMER_ALPHA,
      organizationId: TEST_ORG_ALPHA,
    });

    // Step A: When order is newly created, financial status is unpaid and intake is not started
    expect(order.financialStatus).toBe('unpaid');
    expect(order.intakeStatus).toBe('not_started');
    expect(order.slaStartedAt).toBeUndefined();
    expect(order.deliveryTargetDate).toBeUndefined();

    // Step B: Record a pending payment attempt
    const paymentAttemptId = `pay_sla_${Date.now()}`;
    await persistentDB.recordPaymentAttempt({
      id: paymentAttemptId,
      orderId: order.id,
      paymentMethod: 'sslcommerz',
      paymentStatus: 'initiated',
      amountMinor: 300000,
      currency: 'BDT',
      idempotencyKey: `idemp_sla_${Date.now()}`,
      gatewayRawPayload: {},
      createdAt: new Date().toISOString(),
    });

    // Step C: Payment settled in PostgreSQL, BUT intake is not yet submitted
    const settled = await persistentDB.settleOrderPaymentPaid({
      orderId: order.id,
      paymentAttemptId,
      source: 'sslcommerz_s2s_validated',
      providerValId: 'SSL-VAL-SLA-01',
      evidencePayload: {
        providerValidated: true,
        status: 'VALID',
        tranId: paymentAttemptId,
        valId: 'SSL-VAL-SLA-01',
        amountMinor: 300000,
        currency: 'BDT',
      },
    });

    expect(settled.order.financialStatus).toBe('paid');
    expect(settled.order.status).toBe('awaiting_requirements'); // Waiting for intake!
    expect(settled.order.slaStartedAt).toBeFalsy(); // SLA has NOT started!

    // Step D: Customer completes intake requirements -> triggers SLA clock
    const orderWithIntake = OrderService.completeIntake(settled.order);
    expect(orderWithIntake.intakeStatus).toBe('completed');
    expect(orderWithIntake.status).toBe('ready_for_fulfillment');
    expect(orderWithIntake.slaStartedAt).toBeDefined();
    expect(orderWithIntake.deliveryTargetDate).toBeDefined();

    // Verify service-specific turnaround days: Hero Bundle = 4 business days
    const started = new Date(orderWithIntake.slaStartedAt!);
    const deadline = new Date(orderWithIntake.deliveryTargetDate!);
    const expectedDeadline = addBusinessDays(started, 4);
    expect(deadline.toISOString().split('T')[0]).toBe(expectedDeadline.toISOString().split('T')[0]);
  });
});
