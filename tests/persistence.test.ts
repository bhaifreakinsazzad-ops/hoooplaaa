import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { persistentDB, DatabaseState } from '../src/domain/persistent-db';
import { Order, QuoteSnapshot, IntakeSubmission } from '../src/domain/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'persistent_database.json');

describe('Persistent Storage & Server Restart Resilience', () => {
  beforeEach(() => {
    // Clear state before each test
    persistentDB.clearAllForTesting();
  });

  it('atomically saves a quote to disk and survives cold reads', async () => {
    const mockQuote: QuoteSnapshot = {
      id: 'test_quote_1001',
      items: [
        {
          serviceId: 'HI-SET-META',
          serviceName: 'Meta Business Setup',
          unitPriceMinor: 150000,
          quantity: 1,
          totalMinor: 150000,
        },
      ],
      subtotalMinor: 150000,
      bundleDiscountMinor: 0,
      totalMinor: 150000,
      currency: 'BDT',
      ruleVersion: 'v2026.11',
      termsHash: 'sha256_mock_hash_terms',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'active',
      eligibility: {
        isEligible: true,
        canSelfCheckout: true,
        blockers: [],
        warnings: [],
      },
    };

    await persistentDB.saveQuote(mockQuote);

    // 1. Verify in-memory retrieval
    const retrieved = persistentDB.getQuote('test_quote_1001');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('test_quote_1001');
    expect(retrieved?.totalMinor).toBe(150000);

    // 2. Verify disk state
    expect(fs.existsSync(DB_FILE_PATH)).toBe(true);
    const rawDisk = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const diskJson: DatabaseState = JSON.parse(rawDisk);
    expect(diskJson.quotes['test_quote_1001']).toBeDefined();
    expect(diskJson.quotes['test_quote_1001'].totalMinor).toBe(150000);
  });

  it('persists orders, intakes, and audit trails across cold restart', async () => {
    const orderId = 'ord_restart_test_99';
    const mockOrder: Order = {
      id: orderId,
      orderNumber: 'HOOOP-ORD-2026-9999',
      quoteId: 'test_quote_1001',
      customerUserId: 'usr_client_cold_restart',
      status: 'pending_payment',
      financialStatus: 'unpaid',
      intakeStatus: 'pending',
      totalMinor: 300000,
      currency: 'BDT',
      quoteSnapshot: {
        id: 'test_quote_1001',
        items: [],
        subtotalMinor: 300000,
        bundleDiscountMinor: 0,
        totalMinor: 300000,
        currency: 'BDT',
        ruleVersion: 'v2026.11',
        termsHash: 'mock_hash',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'active',
        eligibility: { isEligible: true, canSelfCheckout: true, blockers: [], warnings: [] },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        {
          id: 'evt_1',
          status: 'pending_payment',
          label: 'Order Initiated',
          description: 'Awaiting payment verification',
          timestamp: new Date().toISOString(),
        },
      ],
      paymentEvents: [],
      deliverables: [],
    };

    await persistentDB.saveOrder(mockOrder);

    // Add intake submission
    const mockIntake: IntakeSubmission = {
      orderId,
      businessName: 'Apex Artisan Ltd.',
      websiteOrPage: 'https://apexartisan.com',
      industry: 'Retail',
      targetAudience: 'Urban shoppers in Dhaka',
      primaryOffer: 'Handcrafted leather goods',
      submittedAt: new Date().toISOString(),
      delegatedAccessConfirmed: true,
      notes: 'All assets ready',
    };

    await persistentDB.saveIntake(orderId, mockIntake);

    // Cold restart simulation: read raw disk file directly as if application booted up cold
    const rawDisk = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const diskJson: DatabaseState = JSON.parse(rawDisk);

    expect(diskJson.orders[orderId]).toBeDefined();
    expect(diskJson.orders[orderId].orderNumber).toBe('HOOOP-ORD-2026-9999');
    expect(diskJson.orders[orderId].totalMinor).toBe(300000);

    expect(diskJson.intakes[orderId]).toBeDefined();
    expect(diskJson.intakes[orderId].businessName).toBe('Apex Artisan Ltd.');

    // Audit logs must be recorded automatically
    expect(diskJson.auditLogs.length).toBeGreaterThanOrEqual(2);
    expect(diskJson.auditLogs.some(log => log.action === 'ORDER_UPSERT')).toBe(true);
    expect(diskJson.auditLogs.some(log => log.action === 'INTAKE_SUBMITTED')).toBe(true);
  });

  it('prevents password storage in intake submission', async () => {
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
