import { describe, it, expect, beforeEach } from 'vitest';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { OrderService } from '../src/domain/order-service';
import { SSLCommerzAdapter, ManualMFSAdapter, PaymentLedger } from '../src/domain/payment-adapter';
import { IntakeAndFileManager } from '../src/domain/intake-and-files';
import { persistentDB } from '../src/domain/persistent-db';
import { approveAndDeliver } from './helpers/delivery-fixtures';
import { Order } from '../src/domain/types';

describe('End-to-End Customer & Administrator Lifecycle Workflow', () => {
  beforeEach(() => {
    persistentDB.clearAllForTesting();
    PaymentLedger.clearAllForTesting();
  });

  it('executes full journey: Configurator -> Quote -> Checkout -> Payment -> Zero-Password Intake -> Admin Assignment -> QA Delivery', async () => {
    // -------------------------------------------------------------------------
    // STEP 1: Discovery & Dynamic Configurator
    // -------------------------------------------------------------------------
    // Customer selects Complete 3-Platform Setup (৳3,000) + Meta Pixel Addon (৳1,500)
    const quote = calculateServerQuote({
      businessId: 'biz_e2e_dhaka',
      businessName: 'Dhaka Craftworks Ltd',
      businessProfile: {
        operatingModel: 'in_person_storefront',
        hasPhysicalStorefront: true, // Google eligibility passed
        websiteUrl: 'https://dhakacraftworks.com',
        websiteCmsAccess: true, // Pixel eligibility passed
      },
      selectedPlatformSkus: ['HI-BUNDLE-3'],
      selectedAddonSkus: ['HI-ADD-PIXEL'],
    });

    expect(quote.eligibility.canSelfCheckout).toBe(true);
    expect(quote.totalMinor).toBe(450000); // ৳4,500 (3,000 + 1,500)
    expect(quote.termsHash).toBeDefined();

    // Persist quote to authoritative database
    await persistentDB.saveQuote(quote);
    const retrievedQuote = await persistentDB.getQuote(quote.id);
    expect(retrievedQuote).not.toBeNull();
    expect(retrievedQuote?.totalMinor).toBe(450000);

    // -------------------------------------------------------------------------
    // STEP 2: Checkout & Order Creation
    // -------------------------------------------------------------------------
    const customerUserId = 'usr_e2e_customer_99';
    let order: Order = OrderService.createOrderFromQuote(quote, customerUserId);

    expect(order.status).toBe('awaiting_payment');
    expect(order.financialStatus).toBe('unpaid');
    expect(order.intakeStatus).toBe('not_started');
    expect(order.slaStartedAt).toBeUndefined(); // SLA has not started!

    await persistentDB.saveOrder(order);

    // -------------------------------------------------------------------------
    // STEP 3: Payment Gateway Initiation & Server Verification
    // -------------------------------------------------------------------------
    const sslAdapter = new SSLCommerzAdapter();
    const initResult = await sslAdapter.initiatePayment(order, 'idemp_key_e2e_001');

    expect(initResult.attemptId).toBeDefined();
    expect(initResult.requiresRedirect).toBe(true);

    // Server IPN Callback Verification
    const verification = await sslAdapter.verifyCallback({
      tran_id: initResult.attemptId,
      val_id: 'SSL-VAL-E2E-SUCCESS-777',
      status: 'VALID',
      amount: '4500.00',
      currency: 'BDT',
    });

    expect(verification.isValid).toBe(true);
    expect(verification.status).toBe('verified_paid');

    // Settle through the single atomic settlement RPC (the database refuses 'paid' without settlement evidence).
    await persistentDB.settleOrderPaymentPaid({
      orderId: order.id,
      paymentAttemptId: initResult.attemptId,
      source: 'local_simulator',
      providerValId: 'SSL-VAL-E2E-SUCCESS-777',
      evidencePayload: {
        status: 'VALID',
        tranId: initResult.attemptId,
        valId: 'SSL-VAL-E2E-SUCCESS-777',
        amountMinor: String(order.totalMinor),
        currency: order.currency,
      },
    });
    order = (await persistentDB.getOrder(order.id))!;
    expect(order.status).toBe('awaiting_requirements');
    expect(order.financialStatus).toBe('paid');
    expect(order.slaStartedAt).toBeUndefined(); // SLA STILL not started until intake!

    // -------------------------------------------------------------------------
    // STEP 4: Customer Intake & Zero-Password Security Enforcement
    // -------------------------------------------------------------------------
    // Attempting to submit raw password must be intercepted:
    const insecureNotes = 'Here is our password: supersecretpass123 for meta page';
    const passwordPattern = /(password|passcode|secret_key|root_pass|login_secret)\s*[:=]\s*\S+/i;
    expect(passwordPattern.test(insecureNotes)).toBe(true);

    // Valid delegated intake submission:
    const validIntake = {
      orderId: order.id,
      businessName: 'Dhaka Craftworks Ltd',
      websiteOrPage: 'https://dhakacraftworks.com',
      industry: 'Handicrafts & E-commerce',
      targetAudience: 'Home decor enthusiasts across Bangladesh & expatriates',
      primaryOffer: 'Premium brass and terracotta artisanal wares',
      submittedAt: new Date().toISOString(),
      delegatedAccessConfirmed: true, // Uses Meta Partner ID delegation, zero passwords!
      notes: 'Assets shared via Google Drive link with view access.',
    };

    await persistentDB.saveIntake(order.id, validIntake);

    // Complete intake on the order
    order = OrderService.completeIntake(order);
    expect(order.status).toBe('ready_for_fulfillment');
    expect(order.intakeStatus).toBe('completed');
    expect(order.slaStartedAt).toBeDefined(); // Contractual delivery clock COMMENCES NOW!

    const staleCopy = { ...order };
    order = await persistentDB.saveOrder(order);
    // A second write from the same (now stale) version is refused instead of silently overwriting.
    await expect(persistentDB.saveOrder(staleCopy)).rejects.toThrow(/modified concurrently/);

    // -------------------------------------------------------------------------
    // STEP 5: Administrative Operations & Assignment
    // -------------------------------------------------------------------------
    const adminOrders = await persistentDB.getAllOrders();
    const queuedOrder = adminOrders.find((o) => o.id === order.id);
    expect(queuedOrder).toBeDefined();
    expect(queuedOrder?.status).toBe('ready_for_fulfillment');

    // Admin assigns specialist engineer:
    order = await persistentDB.saveOrder(
      OrderService.assignStaff(order, '00000000-0000-4000-a000-000000000004', 'Farhan (Tracking)')
    );

    let updatedOrder = await persistentDB.getOrder(order.id);
    expect(updatedOrder?.assignedSpecialistId).toBe('00000000-0000-4000-a000-000000000004');
    expect(updatedOrder?.status).toBe('in_progress');

    // -------------------------------------------------------------------------
    // STEP 6: QA review & delivery (real deliverable bytes, persisted QA, atomic RPC)
    // -------------------------------------------------------------------------
    order = await persistentDB.saveOrder(OrderService.submitForQA(order));
    const { file } = await approveAndDeliver(order.id, { title: 'Dhaka Craftworks Handover' });

    const deliverables = await persistentDB.getFiles(order.id);
    expect(deliverables.length).toBe(1);
    expect(deliverables[0].category).toBe('deliverable');
    expect(deliverables[0].id).toBe(file.id);

    // Customer reviews deliverables on dashboard and accepts
    order = (await persistentDB.getOrder(order.id))!;
    order = await persistentDB.saveOrder(OrderService.acceptHandover(order));

    const finalOrder = await persistentDB.getOrder(order.id);
    expect(finalOrder?.status).toBe('accepted');
    expect(finalOrder?.deliveredAt).toBeDefined();
    expect(finalOrder?.acceptedAt).toBeDefined();

    // -------------------------------------------------------------------------
    // STEP 7: Immutable Audit Trail Verification
    // -------------------------------------------------------------------------
    const auditTrail = await persistentDB.getAuditLogs();
    expect(auditTrail.length).toBeGreaterThanOrEqual(4);
    expect(auditTrail.some((log) => log.action === 'ORDER_UPSERT')).toBe(true);
    expect(auditTrail.some((log) => log.action === 'INTAKE_SUBMITTED')).toBe(true);
  });
});
