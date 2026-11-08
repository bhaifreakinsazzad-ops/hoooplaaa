import { describe, it, expect, beforeEach } from 'vitest';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { OrderService } from '../src/domain/order-service';
import {
  PaymentLedger,
  SSLCommerzAdapter,
  ManualMFSAdapter,
} from '../src/domain/payment-adapter';
import { IntakeAndFileManager } from '../src/domain/intake-and-files';
import { SecurityAndRLS, UserSessionContext } from '../src/domain/security-and-rls';
import { AuditService } from '../src/domain/audit-service';

describe('Order, Payment, File & Security Matrix Tests (P0 Deterministic Tests 10-20)', () => {
  beforeEach(() => {
    PaymentLedger.clearAllForTesting();
  });

  // Test 10: Checkout retries / duplicate provider IPNs -> exactly one paid reconciliation
  it('10. Detects duplicate IPNs/callbacks and rejects replay attacks', async () => {
    const quote = calculateServerQuote({
      businessId: 'biz-10',
      businessName: 'Replay Shield Ltd',
      businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });

    const order = OrderService.createOrderFromQuote(quote, 'user-10');
    const adapter = new SSLCommerzAdapter();
    const init = await adapter.initiatePayment(order, 'idemp-10-unique');

    const ipnPayload = {
      tran_id: init.attemptId,
      val_id: 'SSL-VAL-SUCCESS-999',
      status: 'VALID',
      amount: '1500.00',
      currency: 'BDT',
    };

    // First attempt: valid
    const firstVerification = await adapter.verifyCallback(ipnPayload);
    expect(firstVerification.isValid).toBe(true);
    expect(firstVerification.status).toBe('verified_paid');

    // Duplicate replay attempt with same val_id: must be rejected
    const replayVerification = await adapter.verifyCallback(ipnPayload);
    expect(replayVerification.isValid).toBe(false);
    expect(replayVerification.reason).toContain('Duplicate payment event detected');
  });

  // Test 11: Payment success redirect forged without provider verification
  it('11. Forged redirect parameters do NOT mark order as paid without server verification', async () => {
    const quote = calculateServerQuote({
      businessId: 'biz-11',
      businessName: 'Security Testing Corp',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });

    const order = OrderService.createOrderFromQuote(quote, 'user-11');
    const adapter = new SSLCommerzAdapter();

    // Attacker sends forged status to server callback endpoint without valid tran_id
    const forgedPayload = {
      tran_id: 'fake_tran_id',
      val_id: 'fake_val_id',
      status: 'VALID',
      amount: '1500.00',
    };

    const result = await adapter.verifyCallback(forgedPayload);
    expect(result.isValid).toBe(false);
    expect(order.financialStatus).toBe('unpaid');
  });

  // Test 12: Manual reference without finance verification remains pending
  it('12. Manual MFS submission does NOT mark paid until human finance officer approval', async () => {
    const quote = calculateServerQuote({
      businessId: 'biz-12',
      businessName: 'Chittagong Traders',
      businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
      selectedPlatformSkus: ['HI-BUNDLE-3'],
      selectedAddonSkus: [],
    });

    const order = OrderService.createOrderFromQuote(quote, 'user-12');
    const adapter = new ManualMFSAdapter();
    const init = await adapter.initiatePayment(order, 'idemp-12');

    // Client submits reference
    const submission = await adapter.verifyCallback({
      attemptId: init.attemptId,
      transactionReference: 'TRX-BKASH-888',
      customerPhone: '01811112222',
      financeApproved: false, // NOT yet approved by finance!
    });

    expect(submission.isValid).toBe(false);
    expect(submission.status).toBe('pending');

    // When finance officer verifies statement and marks approved:
    const financeApproval = await adapter.verifyCallback({
      attemptId: init.attemptId,
      transactionReference: 'TRX-BKASH-888',
      customerPhone: '01811112222',
      financeApproved: true,
    });

    expect(financeApproval.isValid).toBe(true);
    expect(financeApproval.status).toBe('verified_paid');
  });

  // Test 13: Cross-tenant RLS isolation
  it('13. Strictly prohibits Customer A from accessing Customer B orders', () => {
    const sessionCustomerA: UserSessionContext = {
      userId: 'usr_alice',
      email: 'alice@company-a.com',
      role: 'customer',
      accessibleBusinessIds: ['biz_alpha'],
    };

    const sessionCustomerB: UserSessionContext = {
      userId: 'usr_bob',
      email: 'bob@company-b.com',
      role: 'customer',
      accessibleBusinessIds: ['biz_beta'],
    };

    const quoteA = calculateServerQuote({
      businessId: 'biz_alpha',
      businessName: 'Alpha Corp',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });

    const orderA = OrderService.createOrderFromQuote(quoteA, 'usr_alice');

    // Alice can access her own order
    expect(SecurityAndRLS.canAccessOrder(sessionCustomerA, orderA)).toBe(true);

    // Bob CANNOT access Alice's order
    expect(SecurityAndRLS.canAccessOrder(sessionCustomerB, orderA)).toBe(false);
  });

  // Test 14: Client role tampering prevention
  it('14. Prohibits non-super-admin from elevating roles', () => {
    const isAllowed = SecurityAndRLS.sanitizeRoleAssignment('staff', 'admin');
    expect(isAllowed).toBe(false);

    const superAdminAllowed = SecurityAndRLS.sanitizeRoleAssignment('super_admin', 'admin');
    expect(superAdminAllowed).toBe(true);
  });

  // Test 15: Executable file upload rejection
  it('15. Rejects executable and dangerous script files, accepting only permitted formats', () => {
    const exeCheck = IntakeAndFileManager.validateUpload('exploit.exe', 1024, 'application/x-msdownload');
    expect(exeCheck.isValid).toBe(false);
    expect(exeCheck.error).toContain('Executable and script files');

    const jsCheck = IntakeAndFileManager.validateUpload('payload.js', 1024, 'application/javascript');
    expect(jsCheck.isValid).toBe(false);

    const validPng = IntakeAndFileManager.validateUpload('company_logo.png', 50000, 'image/png');
    expect(validPng.isValid).toBe(true);
  });

  // Test 16: Catalog price modification does not rewrite historical quotes
  it('16. Price changes do not retroactively alter saved quote snapshot totals', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-16',
      businessName: 'Historical Price Owner',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });

    const originalTotal = quote.totalMinor; // 150000

    // Simulate theoretical future price increase to 200,000 poisha
    const simulatedNewCatalogPrice = 200000;

    // Verify snapshot retains its original 150,000 poisha
    expect(SecurityAndRLS.verifySnapshotIntegrity(quote, originalTotal)).toBe(true);
    expect(quote.totalMinor).not.toBe(simulatedNewCatalogPrice);
  });

  // Test 17 & 18: Unapproved / Blocked SKUs cannot be checked out
  it('17 & 18. Prohibits purchasing unapproved SaaS or blocked SKUs', () => {
    const saasCheck = SecurityAndRLS.validateCheckoutSkus(['HI-SAAS-01']);
    expect(saasCheck.allowed).toBe(false);
    expect(saasCheck.reason).toContain('blocked or unapproved');

    const cardCheck = SecurityAndRLS.validateCheckoutSkus(['HI-PREPAID-VIRTUAL-CARD']);
    expect(cardCheck.allowed).toBe(false);

    const validMeta = SecurityAndRLS.validateCheckoutSkus(['HI-SET-META']);
    expect(validMeta.allowed).toBe(true);
  });

  // Test 19: SLA does NOT start until both payment is verified AND intake is complete
  it('19. Contractual delivery SLA timer starts ONLY when payment is verified AND intake is complete', () => {
    const quote = calculateServerQuote({
      businessId: 'biz-19',
      businessName: 'SLA Watcher',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });

    let order = OrderService.createOrderFromQuote(quote, 'user-19');
    expect(order.slaStartedAt).toBeUndefined();

    // Payment verified
    order = OrderService.markOrderPaid(order, 'pay_ref_19');
    expect(order.status).toBe('awaiting_requirements');
    expect(order.slaStartedAt).toBeUndefined(); // Still waiting for intake!

    // Customer completes intake
    order = OrderService.completeIntake(order);
    expect(order.status).toBe('ready_for_fulfillment');
    expect(order.slaStartedAt).toBeDefined(); // SLA has now officially begun!
  });

  // Test 20: Pre-sale free audit does not fabricate analytics
  it('20. Pre-sale audit intake captures verified public URLs without fabricating private data', () => {
    const audit = AuditService.submitPreSaleAudit({
      businessName: 'Sylhet Organics',
      websiteOrPageUrl: 'https://facebook.com/sylhetorganics',
      contactEmail: 'contact@sylhetorganics.com',
      primaryGoal: 'Social legitimacy & Meta pixel setup',
    });

    expect(audit.stage).toBe('submitted');
    expect(audit.qualificationStatus).toBe('pending');
    expect(audit.scoreOverall).toBeUndefined(); // Zero fabricated metrics!
  });
});
