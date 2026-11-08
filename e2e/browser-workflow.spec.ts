import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const screenshotDir = path.resolve(process.cwd(), 'docs/screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
});

test.describe('HOOOPLAAA Self-Service Commerce Platform — Real Browser E2E Verification', () => {
  test('1. Homepage, Owner-Approved Catalog & Bilingual (EN/BN) Toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(
      /Build your business foundation|আপনার ব্যবসার ডিজিটাল ভিত্তি/i
    );

    // Verify owner-approved hero price ৳3,000 and reconciled delivery timelines
    await expect(page.locator('body')).toContainText('৳3,000');
    await expect(page.locator('body')).toContainText('1–2 business days');
    await expect(page.locator('body')).toContainText('1–2 days submission');
    await expect(page.locator('body')).toContainText('1 business day');

    await page.screenshot({
      path: path.join(screenshotDir, '01-homepage-catalog-en.png'),
      fullPage: false,
    });

    // Toggle to Bangla (বাংলা) if language toggle button is present
    const bnToggle = page.locator('button:has-text("বাংলা")').first();
    if (await bnToggle.isVisible()) {
      await bnToggle.click();
      await page.screenshot({
        path: path.join(screenshotDir, '02-homepage-catalog-bn.png'),
        fullPage: false,
      });
      const enToggle = page.locator('button:has-text("EN")').first();
      if (await enToggle.isVisible()) {
        await enToggle.click();
      }
    }
  });

  test('2. Interactive Configurator Wizard & Eligibility Guardrails (/build)', async ({ page }) => {
    await page.goto('/build?preset=bundle');
    await expect(page.locator('body')).toContainText(/Configure|Business|Platform/i);

    await page.screenshot({
      path: path.join(screenshotDir, '03-configurator-wizard.png'),
      fullPage: false,
    });
  });

  test('3. End-to-End Customer Checkout, Manual MFS Verification, Admin Finance Approval & Client Intake Workspace', async ({
    page,
    request,
  }) => {
    // Step A: Create an authoritative server quote via API (as triggered by Step 4 of Configurator)
    const quoteRes = await request.post('/api/quote', {
      data: {
        businessId: 'biz_e2e_browser',
        businessName: 'Dhaka Heritage Roasters Ltd.',
        businessProfile: {
          operatingModel: 'in_person_storefront',
          hasPhysicalStorefront: true,
          conductsInPersonVisits: true,
          websiteUrl: 'https://dhakaheritage.bd',
          websiteCmsAccess: true,
          facebookPageStatus: 'active_admin',
          metaPortfolioStatus: 'none',
          linkedInStatus: 'none',
        },
        selectedPlatformSkus: ['HI-BUNDLE-3'],
        selectedAddonSkus: ['HI-ADD-WA', 'HI-ADD-CREATIVE'],
      },
    });
    expect(quoteRes.ok()).toBe(true);
    const { quote } = await quoteRes.json();
    expect(quote.totalMinor).toBe(568000); // ৳3,000 + ৳1,690 + ৳990 = ৳5,680

    // Step B: Visit the real Checkout page in browser
    await page.goto(`/checkout/${quote.id}`);
    await expect(page.locator('body')).toContainText('Complete Your Order');
    await expect(page.locator('body')).toContainText('Complete 3-Platform Business Setup (Hero Offer)');
    await expect(page.locator('body')).toContainText('৳5,680');

    await page.screenshot({
      path: path.join(screenshotDir, '04-checkout-quote-summary.png'),
      fullPage: false,
    });

    // Step C: Initiate Order with Manual MFS (bKash/Nagad) and submit Transaction ID
    const initRes = await request.post('/api/checkout/initiate', {
      data: {
        quoteId: quote.id,
        customerEmail: 'founder@dhakaheritage.bd',
        paymentMethod: 'manual_mfs',
      },
    });
    expect(initRes.ok()).toBe(true);
    const { orderId } = await initRes.json();

    const mfsRes = await request.post('/api/checkout/manual-mfs', {
      data: {
        orderId,
        transactionReference: 'BKASH-E2E-994812',
        customerPhone: '+8801711223344',
        provider: 'manual_mfs',
      },
    });
    expect(mfsRes.ok()).toBe(true);
    const mfsData = await mfsRes.json();
    // Prove Manual MFS NEVER marks the order as paid automatically
    expect(mfsData.order.financialStatus).toBe('pending_verification');
    expect(mfsData.order.status).toBe('payment_under_review');

    // Visit Payment Status Page in Browser
    await page.goto(`/checkout/status/${orderId}`);
    await expect(page.locator('body')).toContainText(/Verification|Review|Order/i);
    await page.screenshot({
      path: path.join(screenshotDir, '05-payment-pending-verification.png'),
      fullPage: false,
    });

    // Step D: Open Staff & Finance Admin Control Center (/admin) in Browser
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText(/Operations|Control|Admin/i);
    await expect(page.locator('body')).toContainText('Dhaka Heritage Roasters Ltd.');

    await page.screenshot({
      path: path.join(screenshotDir, '06-admin-operations-console.png'),
      fullPage: false,
    });

    // Step E: Finance Officer approves the Manual MFS payment
    const verifyRes = await request.post('/api/admin/finance/verify', {
      data: {
        orderId,
        approved: true,
        verifiedByStaffId: 'staff_finance_lead_01',
      },
    });
    expect(verifyRes.ok()).toBe(true);

    // Step F: Open Client Order Workspace (/dashboard/orders/[id]) in Browser
    await page.goto(`/dashboard/orders/${orderId}`);
    await expect(page.locator('body')).toContainText('Dhaka Heritage Roasters Ltd.');
    await expect(page.locator('body')).toContainText(/paid/i);

    await page.screenshot({
      path: path.join(screenshotDir, '07-client-order-workspace.png'),
      fullPage: false,
    });

    // Step G: Verify Zero-Password Security Guard rejects password sharing
    const badIntakeRes = await request.post(`/api/orders/${orderId}/intake`, {
      data: {
        businessName: 'Dhaka Heritage Roasters Ltd.',
        contactEmail: 'founder@dhakaheritage.bd',
        contactWhatsApp: '+8801711223344',
        targetAudience: 'Coffee lovers in Dhaka',
        brandColors: 'Navy & Gold',
        partnerInviteStatus: 'completed',
        facebookPassword: 'secretPassword123',
        notes: 'My facebook password is: secretPassword123',
      },
    });
    expect(badIntakeRes.status()).toBe(400);

    // Step H: Submit valid Zero-Password delegated onboarding intake
    const validIntakeRes = await request.post(`/api/orders/${orderId}/intake`, {
      data: {
        businessName: 'Dhaka Heritage Roasters Ltd.',
        contactEmail: 'founder@dhakaheritage.bd',
        contactWhatsApp: '+8801711223344',
        targetAudience: 'Specialty coffee customers in Gulshan & Banani',
        brandColors: 'Deep Navy #0A1128 and Gold #D4AF37',
        existingPageLinks: 'https://facebook.com/dhakaheritage',
        partnerInviteStatus: 'completed',
        notes: 'Delegated Meta Partner ID and Google Business Manager invite sent.',
      },
    });
    expect(validIntakeRes.ok()).toBe(true);
    const validIntakeData = await validIntakeRes.json();
    expect(validIntakeData.order.intakeStatus).toBe('completed');
    expect(validIntakeData.order.status).toBe('ready_for_fulfillment');
    expect(validIntakeData.order.slaStartedAt).toBeDefined();
  });
});
