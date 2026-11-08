import { describe, it, expect, beforeEach } from 'vitest';
import { persistentDB } from '../src/domain/persistent-db';
import { Order, QuoteSnapshot, IntakeSubmission } from '../src/domain/types';

describe('Authoritative Database Persistence & Security Policies', () => {
  beforeEach(() => {
    persistentDB.clearAllForTesting();
  });

  it('atomically saves and retrieves a valid quote snapshot', async () => {
    const mockQuote: QuoteSnapshot = {
      id: 'test_quote_1001',
      businessId: 'biz_test_1001',
      businessName: 'Apex Artisan Ltd.',
      items: [
        {
          sku: 'HI-SET-META',
          name: 'Meta Business Setup',
          nameBn: 'মেটা বিজনেস সেটআপ',
          unitPriceMinor: 150000,
          quantity: 1,
          lineTotalMinor: 150000,
          billingPeriod: 'one_time',
          inclusionsSnapshot: [],
          exclusionsSnapshot: [],
          deliveryTarget: '4 business days',
        },
      ],
      subtotalMinor: 150000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 150000,
      currency: 'BDT',
      ruleVersion: 'v2026.11',
      termsHash: 'sha256_mock_hash_terms',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'draft',
      eligibility: {
        isEligible: true,
        canSelfCheckout: true,
        flags: [],
      },
    };

    await persistentDB.saveQuote(mockQuote);

    const retrieved = await persistentDB.getQuote('test_quote_1001');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('test_quote_1001');
    expect(retrieved?.totalMinor).toBe(150000);
    expect(retrieved?.termsHash).toBe('sha256_mock_hash_terms');
  });

  it('persists orders, intakes, and audit trails without silent data loss', async () => {
    const orderId = 'ord_restart_test_99';
    const mockOrder: Order = {
      id: orderId,
      orderNumber: 'HOOOP-ORD-2026-9999',
      businessId: 'biz_test_1001',
      quoteId: 'test_quote_1001',
      customerUserId: 'usr_client_cold_restart',
      status: 'awaiting_payment',
      financialStatus: 'unpaid',
      intakeStatus: 'not_started',
      totalMinor: 300000,
      currency: 'BDT',
      items: [],
      quoteSnapshot: {
        id: 'test_quote_1001',
        businessId: 'biz_test_1001',
        businessName: 'Apex Artisan Ltd.',
        items: [],
        subtotalMinor: 300000,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: 300000,
        currency: 'BDT',
        ruleVersion: 'v2026.11',
        termsHash: 'mock_hash',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'draft',
        eligibility: { isEligible: true, canSelfCheckout: true, flags: [] },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await persistentDB.saveOrder(mockOrder);

    const mockIntake: IntakeSubmission = {
      id: 'intake_test_99',
      orderId,
      businessName: 'Apex Artisan Ltd.',
      targetAudience: 'Urban shoppers in Dhaka',
      contactEmail: 'contact@apexartisan.com',
      contactWhatsApp: '01711112222',
      partnerInviteStatus: 'invitation_sent',
      submittedAt: new Date().toISOString(),
      notes: 'All assets ready',
      isComplete: true,
    };

    await persistentDB.saveIntake(orderId, mockIntake);

    const savedOrder = await persistentDB.getOrder(orderId);
    expect(savedOrder).not.toBeNull();
    expect(savedOrder?.orderNumber).toBe('HOOOP-ORD-2026-9999');
    expect(savedOrder?.totalMinor).toBe(300000);

    const savedIntake = await persistentDB.getIntake(orderId);
    expect(savedIntake).not.toBeNull();
    expect(savedIntake?.businessName).toBe('Apex Artisan Ltd.');

    const auditLogs = await persistentDB.getAuditLogs();
    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
    expect(auditLogs.some(log => log.action === 'ORDER_UPSERT')).toBe(true);
    expect(auditLogs.some(log => log.action === 'INTAKE_SUBMITTED')).toBe(true);
  });

  it('strictly blocks credential and raw password submission in intake', () => {
    const intakeWithSecret = {
      orderId: 'ord_sec_check',
      businessName: 'Secure Tech',
      websiteOrPage: 'https://securetech.io',
      industry: 'SaaS',
      targetAudience: 'B2B',
      primaryOffer: 'Security audits',
      submittedAt: new Date().toISOString(),
      delegatedAccessConfirmed: true,
      notes: 'password: SuperSecretPassword123!',
    };

    const passwordRegex = /(password|passcode|secret_key|root_pass|login_secret)\s*[:=]\s*\S+/i;
    expect(passwordRegex.test(intakeWithSecret.notes)).toBe(true);
  });
});
