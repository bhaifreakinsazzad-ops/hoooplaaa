import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const screenshotDir = path.resolve(process.cwd(), 'docs/screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
});

test.describe('HOOOPLAAA V5 — Authenticated Multi-Actor Browser E2E & RBAC Security Suite', () => {
  test('1. Interactive Configurator Controls, Eligibility Guardrails & Bilingual UI (/ & /build)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(
      /Build your business foundation|আপনার ব্যবসার ডিজিটাল ভিত্তি/i
    );
    await expect(page.locator('body')).toContainText('৳3,000');
    await expect(page.locator('body')).toContainText('1–2 business days');
    await expect(page.locator('body')).toContainText('1–2 days submission');
    await expect(page.locator('body')).toContainText('1 business day');

    await page.screenshot({
      path: path.join(screenshotDir, '01-homepage-catalog-en.png'),
      fullPage: false,
    });

    // Bilingual toggle
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

    // Navigate to /build and interact with real Configurator controls
    await page.goto('/build?preset=bundle');
    const bizInput = page.locator('input[type="text"]').first();
    await expect(bizInput).toBeVisible();
    await bizInput.fill('Dhaka Heritage Roasters Ltd.');

    // Advance from Step 1 to Step 2
    const nextBtn1 = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
    if (await nextBtn1.isVisible()) {
      await nextBtn1.click();
    }

    await page.screenshot({
      path: path.join(screenshotDir, '03-configurator-wizard.png'),
      fullPage: false,
    });
  });

  test('2. Priority 0 Security Matrix: Unauthenticated (401) & Customer Privilege Escalation Denial (403)', async ({
    page,
    request,
  }) => {
    // A. Unauthenticated API calls MUST return HTTP 401
    const unauthFinance = await request.post('/api/admin/finance/verify', {
      data: { orderId: 'ord_any', approved: true },
    });
    expect(unauthFinance.status()).toBe(401);

    const unauthAdminOrders = await request.get('/api/admin/orders');
    expect(unauthAdminOrders.status()).toBe(401);

    const unauthAuditList = await request.get('/api/audit');
    expect(unauthAuditList.status()).toBe(401);

    const unauthCheckout = await request.post('/api/checkout/initiate', {
      data: { quoteId: 'quo_any', paymentMethod: 'manual_mfs' },
    });
    expect(unauthCheckout.status()).toBe(401);

    // Unauthenticated browser visit to /admin must show HTTP 401 barrier
    await page.goto('/admin');
    await expect(page.getByTestId('admin-auth-barrier')).toContainText('HTTP 401');

    // B. Authenticate as Customer A via real /login page
    await page.goto('/login?redirect=/dashboard');
    await page.fill('#login-email', 'alice@dhakaheritage.bd');
    await page.fill('#login-password', 'CustomerA#2026!');
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForURL((url) => url.pathname === '/dashboard');

    // Extract Customer A session cookie from browser context
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'sb-access-token' || c.name === 'hoooplaaa_session');
    expect(sessionCookie).toBeDefined();
    const customerHeaders = {
      Authorization: `Bearer ${sessionCookie!.value}`,
    };

    // Customer A attempting finance approval MUST return HTTP 403
    const custFinanceAttempt = await request.post('/api/admin/finance/verify', {
      headers: customerHeaders,
      data: { orderId: 'ord_any', approved: true },
    });
    expect(custFinanceAttempt.status()).toBe(403);

    // Customer A attempting admin orders list MUST return HTTP 403
    const custAdminOrdersAttempt = await request.get('/api/admin/orders', {
      headers: customerHeaders,
    });
    expect(custAdminOrdersAttempt.status()).toBe(403);

    // Customer A attempting confidential audit list MUST return HTTP 403
    const custAuditListAttempt = await request.get('/api/audit', {
      headers: customerHeaders,
    });
    expect(custAuditListAttempt.status()).toBe(403);

    // Customer A attempting to modify their own role or organizationId MUST return HTTP 403
    const roleEscalationAttempt = await request.patch('/api/auth/session', {
      headers: customerHeaders,
      data: { role: 'admin', organizationId: '10000000-0000-4000-a000-000000000099' },
    });
    expect(roleEscalationAttempt.status()).toBe(403);

    // Customer A visiting /admin in browser sees HTTP 403 barrier
    await page.goto('/admin');
    await expect(page.getByTestId('admin-auth-barrier')).toContainText('HTTP 403');
  });

  test('3. Full Authenticated Multi-Actor Lifecycle: Customer A Order & Real File Upload -> Customer B Cross-Tenant Denial (403) -> Finance Officer Approval -> Admin Fulfillment', async ({
    page,
    request,
  }) => {
    // -------------------------------------------------------------------------
    // ACTOR 1: CUSTOMER A (alice@dhakaheritage.bd)
    // -------------------------------------------------------------------------
    await page.goto('/login');
    await page.fill('#login-email', 'alice@dhakaheritage.bd');
    await page.fill('#login-password', 'CustomerA#2026!');
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForURL((url) => url.pathname === '/dashboard');

    const customerACookies = await page.context().cookies();
    const customerAToken = customerACookies.find(
      (c) => c.name === 'sb-access-token' || c.name === 'hoooplaaa_session'
    )!.value;
    const customerAHeaders = { Authorization: `Bearer ${customerAToken}` };

    // Create authoritative server quote for Customer A
    const quoteRes = await request.post('/api/quote', {
      headers: customerAHeaders,
      data: {
        businessName: 'Dhaka Heritage Roasters Ltd.',
        businessProfile: {
          operatingModel: 'in_person_storefront',
          hasPhysicalStorefront: true,
          conductsInPersonVisits: true,
          websiteUrl: 'https://dhakaheritage.bd',
          websiteCmsAccess: true,
        },
        selectedPlatformSkus: ['HI-BUNDLE-3'],
        selectedAddonSkus: ['HI-ADD-WA', 'HI-ADD-CREATIVE'],
      },
    });
    expect(quoteRes.ok()).toBe(true);
    const { quote } = await quoteRes.json();
    expect(quote.totalMinor).toBe(568000); // ৳5,680

    // Visit Checkout page in browser
    await page.goto(`/checkout/${quote.id}`);
    await expect(page.locator('body')).toContainText('Complete Your Order');
    await expect(page.locator('body')).toContainText('৳5,680');
    await page.screenshot({
      path: path.join(screenshotDir, '04-checkout-quote-summary.png'),
      fullPage: false,
    });

    // Initiate Checkout as Customer A
    const initRes = await request.post('/api/checkout/initiate', {
      headers: customerAHeaders,
      data: {
        quoteId: quote.id,
        paymentMethod: 'manual_mfs',
      },
    });
    expect(initRes.ok()).toBe(true);
    const { orderId } = await initRes.json();

    // Submit Manual MFS reference as Customer A
    const mfsRes = await request.post('/api/checkout/manual-mfs', {
      headers: customerAHeaders,
      data: {
        orderId,
        transactionReference: 'BKASH-V5-AUTH-88219',
        customerPhone: '+8801711223344',
      },
    });
    expect(mfsRes.ok()).toBe(true);
    const mfsData = await mfsRes.json();
    expect(mfsData.order.financialStatus).toBe('pending_verification');
    expect(mfsData.order.status).toBe('payment_under_review');

    await page.goto(`/checkout/status/${orderId}`);
    await expect(page.locator('body')).toContainText(/Verification|Review|Order/i);
    await page.screenshot({
      path: path.join(screenshotDir, '05-payment-pending-verification.png'),
      fullPage: false,
    });

    // Customer A: Verify fake file upload without bytes is rejected (400)
    const fakeFileRes = await request.post(`/api/orders/${orderId}/files`, {
      headers: customerAHeaders,
      data: {
        fileName: 'fake_empty.png',
        mimeType: 'image/png',
      },
    });
    expect(fakeFileRes.status()).toBe(400);

    // Customer A: Upload REAL binary PNG file bytes and verify SHA-256 integrity
    const realPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const expectedSha256 = crypto
      .createHash('sha256')
      .update(Buffer.from(realPngBase64, 'base64'))
      .digest('hex');

    const realFileRes = await request.post(`/api/orders/${orderId}/files`, {
      headers: customerAHeaders,
      data: {
        fileName: 'dhaka_heritage_logo.png',
        mimeType: 'image/png',
        fileContentBase64: realPngBase64,
      },
    });
    expect(realFileRes.ok()).toBe(true);
    const { file: uploadedFile } = await realFileRes.json();
    expect(uploadedFile.sha256Hash).toBe(expectedSha256);

    // Download private file as Customer A and verify binary content & SHA-256 header
    const downloadRes = await request.get(
      `/api/orders/${orderId}/files?download=${uploadedFile.id}`,
      { headers: customerAHeaders }
    );
    expect(downloadRes.ok()).toBe(true);
    expect(downloadRes.headers()['x-content-sha256']).toBe(expectedSha256);

    // -------------------------------------------------------------------------
    // ACTOR 2: CUSTOMER B (bob@chittagongtraders.bd) — CROSS-TENANT DENIAL (403)
    // -------------------------------------------------------------------------
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('#login-email', 'bob@chittagongtraders.bd');
    await page.fill('#login-password', 'CustomerB#2026!');
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForURL((url) => url.pathname === '/dashboard');

    const customerBCookies = await page.context().cookies();
    const customerBToken = customerBCookies.find(
      (c) => c.name === 'sb-access-token' || c.name === 'hoooplaaa_session'
    )!.value;
    const customerBHeaders = { Authorization: `Bearer ${customerBToken}` };

    // Customer B attempting to read Customer A's order -> 403 Forbidden
    const crossOrderGet = await request.get(`/api/checkout/initiate?id=${orderId}`, {
      headers: customerBHeaders,
    });
    expect(crossOrderGet.status()).toBe(403);

    // Customer B attempting to read or submit intake on Customer A's order -> 403 Forbidden
    const crossIntakeGet = await request.get(`/api/orders/${orderId}/intake`, {
      headers: customerBHeaders,
    });
    expect(crossIntakeGet.status()).toBe(403);

    const crossIntakePost = await request.post(`/api/orders/${orderId}/intake`, {
      headers: customerBHeaders,
      data: {
        businessName: 'Hijacked',
        contactEmail: 'bob@chittagongtraders.bd',
        contactWhatsApp: '+8801811223355',
        targetAudience: 'Hijack',
        partnerInviteStatus: 'completed',
      },
    });
    expect(crossIntakePost.status()).toBe(403);

    // Customer B attempting to read or download Customer A's private files -> 403 Forbidden
    const crossFilesGet = await request.get(
      `/api/orders/${orderId}/files?download=${uploadedFile.id}`,
      { headers: customerBHeaders }
    );
    expect(crossFilesGet.status()).toBe(403);

    // Customer B visiting Customer A's order workspace in the browser sees HTTP 403 error
    await page.goto(`/dashboard/orders/${orderId}`);
    await expect(page.getByTestId('order-access-error')).toContainText('HTTP 403');

    // -------------------------------------------------------------------------
    // ACTOR 3: FINANCE OFFICER (finance@hoooplaaa.com) — PAYMENT VERIFICATION
    // -------------------------------------------------------------------------
    await page.context().clearCookies();
    await page.goto('/login?redirect=/admin');
    await page.fill('#login-email', 'finance@hoooplaaa.com');
    await page.fill('#login-password', 'Finance#2026!');
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForURL((url) => url.pathname === '/admin');

    await expect(page.locator('h1')).toContainText(/Operations|Control|Admin/i);
    await expect(page.locator('body')).toContainText('Dhaka Heritage Roasters Ltd.');
    await page.screenshot({
      path: path.join(screenshotDir, '06-admin-operations-console.png'),
      fullPage: false,
    });

    const financeCookies = await page.context().cookies();
    const financeToken = financeCookies.find(
      (c) => c.name === 'sb-access-token' || c.name === 'hoooplaaa_session'
    )!.value;
    const financeHeaders = { Authorization: `Bearer ${financeToken}` };

    // Finance Officer approves payment; server derives verifiedByStaffId from session (ignoring spoofed body field)
    const verifyRes = await request.post('/api/admin/finance/verify', {
      headers: financeHeaders,
      data: {
        orderId,
        approved: true,
        verifiedByStaffId: 'spoofed_body_id_ignored_by_server',
      },
    });
    expect(verifyRes.ok()).toBe(true);
    const verifyData = await verifyRes.json();
    expect(verifyData.verifiedByStaffId).toBe('00000000-0000-4000-a000-000000000003');
    expect(verifyData.order.financialStatus).toBe('paid');

    // -------------------------------------------------------------------------
    // ACTOR 1 RETURNS: CUSTOMER A SUBMITS ZERO-PASSWORD INTAKE -> SLA STARTS
    // -------------------------------------------------------------------------
    // Reject intake containing password
    const badIntakeRes = await request.post(`/api/orders/${orderId}/intake`, {
      headers: customerAHeaders,
      data: {
        businessName: 'Dhaka Heritage Roasters Ltd.',
        contactEmail: 'alice@dhakaheritage.bd',
        contactWhatsApp: '+8801711223344',
        targetAudience: 'Coffee lovers',
        facebookPassword: 'secretPassword123',
      },
    });
    expect(badIntakeRes.status()).toBe(400);

    // Submit valid delegated intake
    const validIntakeRes = await request.post(`/api/orders/${orderId}/intake`, {
      headers: customerAHeaders,
      data: {
        businessName: 'Dhaka Heritage Roasters Ltd.',
        contactEmail: 'alice@dhakaheritage.bd',
        contactWhatsApp: '+8801711223344',
        targetAudience: 'Specialty coffee customers in Dhaka',
        brandColors: 'Deep Navy #0A1128 and Gold #D4AF37',
        existingPageLinks: 'https://facebook.com/dhakaheritage',
        partnerInviteStatus: 'completed',
        notes: 'Delegated Meta Partner ID and Google Business Profile manager invite sent.',
      },
    });
    expect(validIntakeRes.ok()).toBe(true);
    const validIntakeData = await validIntakeRes.json();
    expect(validIntakeData.order.intakeStatus).toBe('completed');
    expect(validIntakeData.order.status).toBe('ready_for_fulfillment');
    expect(validIntakeData.order.slaStartedAt).toBeDefined();

    // -------------------------------------------------------------------------
    // ACTOR 4: ADMINISTRATOR (admin@hoooplaaa.com) — ASSIGN, QA & DELIVER
    // -------------------------------------------------------------------------
    await page.context().clearCookies();
    await page.goto('/login?redirect=/admin');
    await page.fill('#login-email', 'admin@hoooplaaa.com');
    await page.fill('#login-password', 'Admin#2026!');
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForURL((url) => url.pathname === '/admin');

    const adminCookies = await page.context().cookies();
    const adminToken = adminCookies.find(
      (c) => c.name === 'sb-access-token' || c.name === 'hoooplaaa_session'
    )!.value;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const assignRes = await request.post('/api/admin/orders', {
      headers: adminHeaders,
      data: { orderId, action: 'assign_staff', specialistName: 'Tanvir Ahmed (Senior Specialist)' },
    });
    expect(assignRes.ok()).toBe(true);

    const qaRes = await request.post('/api/admin/orders', {
      headers: adminHeaders,
      data: { orderId, action: 'submit_qa' },
    });
    expect(qaRes.ok()).toBe(true);

    const deliverRes = await request.post('/api/admin/orders', {
      headers: adminHeaders,
      data: { orderId, action: 'deliver' },
    });
    expect(deliverRes.ok()).toBe(true);
    const deliverData = await deliverRes.json();
    expect(deliverData.order.status).toBe('delivered');

    // View Order Workspace in Browser and capture screenshot
    await page.goto(`/dashboard/orders/${orderId}`);
    await expect(page.locator('body')).toContainText('Dhaka Heritage Roasters Ltd.');
    await expect(page.locator('body')).toContainText(/delivered/i);
    await page.screenshot({
      path: path.join(screenshotDir, '07-client-order-workspace.png'),
      fullPage: false,
    });
  });
});
