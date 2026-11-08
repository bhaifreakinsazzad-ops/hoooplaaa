import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { persistentDB } from '../src/domain/persistent-db';
import { authenticateCredentials } from '../src/domain/auth-guard';
import { guestClaimCookieName } from '../src/domain/guest-claim';
import { getInitializedTestPostgres, resetTestPostgresData } from '../src/testing/supabase-pglite-bridge';
import { POST as quotePost, GET as quoteGet } from '../src/app/api/quote/route';
import { POST as initiatePost } from '../src/app/api/checkout/initiate/route';
import { POST as manualPost } from '../src/app/api/checkout/manual-mfs/route';
import { POST as financeVerify } from '../src/app/api/admin/finance/verify/route';
import { POST as sslCallback } from '../src/app/api/checkout/callback/sslcommerz/route';

/**
 * Route-handler level tests (LOCAL ONLY — PGlite bridge, in-process NextRequest; not a browser and not
 * a deployed Supabase project). They exercise the real route code, cookies, headers and DB state.
 */

const BASE = 'http://localhost:3000';
const APP_QUOTE_BODY = {
  businessName: 'Guest Cookie Roasters',
  businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
  selectedPlatformSkus: ['HI-SET-META'],
  selectedAddonSkus: [],
};

function req(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return new NextRequest(`${BASE}${path}`, {
    method: init.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function parseSetCookie(res: Response, name: string): { value: string; raw: string } | null {
  const all = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [res.headers.get('set-cookie') || ''];
  const raw = all.find((c: string) => c.startsWith(`${name}=`));
  if (!raw) return null;
  return { value: raw.split(';')[0].slice(name.length + 1), raw };
}

async function guestQuote(extraHeaders: Record<string, string> = {}, url = '/api/quote') {
  const res = await quotePost(req(url, { method: 'POST', headers: extraHeaders, body: APP_QUOTE_BODY }));
  const json = await res.json();
  const cookieName = guestClaimCookieName(json.quote.id);
  return { res, json, quoteId: json.quote.id as string, cookieName, cookie: parseSetCookie(res, cookieName) };
}

async function login(email: string, password: string) {
  const r = await authenticateCredentials(email, password);
  if (!r) throw new Error('login failed in test harness');
  return r.token;
}

describe('V7.2R — guest quote handoff through the real API routes (LOCAL ONLY)', () => {
  beforeEach(async () => {
    await resetTestPostgresData();
  });

  it('1. Guest quote response carries NO claim secret; capability is an HttpOnly SameSite=Strict path-scoped cookie', async () => {
    const { res, json, cookie } = await guestQuote();
    expect(res.status).toBe(200);
    expect(JSON.stringify(json)).not.toMatch(/claimToken|claimTokenHash/);
    expect(cookie).not.toBeNull();
    expect(JSON.stringify(json)).not.toContain(cookie!.value);
    expect(cookie!.raw).toMatch(/HttpOnly/i);
    expect(cookie!.raw).toMatch(/SameSite=strict/i);
    expect(cookie!.raw).toMatch(/Path=\/api(;|$)/i);
    expect(cookie!.raw).toMatch(/Max-Age=1800/i);
    expect(cookie!.raw).not.toMatch(/Secure/i); // plain http on localhost only
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(cookie!.value.length).toBeGreaterThanOrEqual(43);
  });

  it('2. Secure flag is added over HTTPS (x-forwarded-proto / https URL)', async () => {
    const { cookie } = await guestQuote({ 'x-forwarded-proto': 'https' });
    expect(cookie!.raw).toMatch(/Secure/i);
  });

  it('3. Quote id alone never reads a guest quote: no cookie / wrong cookie => 404 (no enumeration signal)', async () => {
    const { quoteId, cookieName, cookie } = await guestQuote();
    const none = await quoteGet(req(`/api/quote?id=${quoteId}`));
    expect(none.status).toBe(404);
    const wrong = await quoteGet(req(`/api/quote?id=${quoteId}`, { headers: { cookie: `${cookieName}=${'a'.repeat(43)}` } }));
    expect(wrong.status).toBe(404);
    const missing = await quoteGet(req(`/api/quote?id=QUO-DOES-NOT-EXIST`));
    expect(missing.status).toBe(404);
    const ok = await quoteGet(req(`/api/quote?id=${quoteId}`, { headers: { cookie: `${cookieName}=${cookie!.value}` } }));
    expect(ok.status).toBe(200);
    expect(JSON.stringify(await ok.json())).not.toContain(cookie!.value);
  });

  it('4. Cross-origin state-changing requests are rejected (CSRF/origin protection)', async () => {
    const evil = await quotePost(req('/api/quote', { method: 'POST', headers: { origin: 'https://evil.example' }, body: APP_QUOTE_BODY }));
    expect(evil.status).toBe(403);
    const site = await quotePost(req('/api/quote', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: APP_QUOTE_BODY }));
    expect(site.status).toBe(403);
    const same = await quotePost(req('/api/quote', { method: 'POST', headers: { origin: BASE, host: 'localhost:3000' }, body: APP_QUOTE_BODY }));
    expect(same.status).toBe(200);
  });

  it('5. Legitimate guest->auth handoff: cookie claims once; replay/other tenant/other browser are denied; cookie cleared', async () => {
    const { quoteId, cookieName, cookie } = await guestQuote();
    const alice = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
    const bob = await login('bob@chittagongtraders.bd', 'CustomerB#2026!');
    const initiate = (token: string, cookieHeader?: string, extra: Record<string, string> = {}) =>
      initiatePost(
        req('/api/checkout/initiate', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, ...(cookieHeader ? { cookie: cookieHeader } : {}), ...extra },
          body: { quoteId, paymentMethod: 'manual_mfs' },
        })
      );

    // Different browser (no cookie): even a logged-in customer cannot claim a guest quote by id.
    const noCookie = await initiate(bob);
    expect(noCookie.status).toBe(403);
    // Cross-origin POST with a valid cookie is rejected before anything happens.
    const csrf = await initiate(alice, `${cookieName}=${cookie!.value}`, { origin: 'https://evil.example' });
    expect(csrf.status).toBe(403);

    // The legitimate browser claims (Alice).
    const ok = await initiate(alice, `${cookieName}=${cookie!.value}`);
    expect(ok.status).toBe(200);
    const cleared = parseSetCookie(ok, cookieName);
    expect(cleared?.raw).toMatch(/Max-Age=0/i);

    // Replay of the same cookie by another tenant is denied; the quote now belongs to Alice only.
    const replay = await initiate(bob, `${cookieName}=${cookie!.value}`);
    expect(replay.status).toBe(403);
    const q = await persistentDB.getQuote(quoteId);
    expect(q?.customerId).toBe('00000000-0000-4000-a000-000000000001');

    // Guest cookie no longer reads the (now owned) quote; owner does.
    const guestRead = await quoteGet(req(`/api/quote?id=${quoteId}`, { headers: { cookie: `${cookieName}=${cookie!.value}` } }));
    expect(guestRead.status).toBe(401);
    const ownerRead = await quoteGet(req(`/api/quote?id=${quoteId}`, { headers: { authorization: `Bearer ${alice}` } }));
    expect(ownerRead.status).toBe(200);
    const bobRead = await quoteGet(req(`/api/quote?id=${quoteId}`, { headers: { authorization: `Bearer ${bob}` } }));
    expect(bobRead.status).toBe(403);
  });

  it('6. Duplicate and concurrent checkout requests yield ONE order and ONE open manual payment attempt', async () => {
    const { quoteId, cookieName, cookie } = await guestQuote();
    const alice = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
    const call = (withCookie: boolean) =>
      initiatePost(
        req('/api/checkout/initiate', {
          method: 'POST',
          headers: { authorization: `Bearer ${alice}`, ...(withCookie ? { cookie: `${cookieName}=${cookie!.value}` } : {}) },
          body: { quoteId, paymentMethod: 'manual_mfs' },
        })
      );
    const first = await call(true);
    expect(first.status).toBe(200);
    const firstJson = await first.json();

    const burst = await Promise.all([call(false), call(false), call(false), call(true)]);
    for (const r of burst) {
      expect(r.status).toBe(200);
      const j = await r.json();
      expect(j.orderId).toBe(firstJson.orderId);
      expect(j.attemptId).toBe(firstJson.attemptId);
    }
    const orders = await persistentDB.listAllOrders();
    expect(orders.filter((o) => o.id === firstJson.orderId).length).toBe(1);
    expect((await persistentDB.getPaymentsForOrder(firstJson.orderId)).length).toBe(1);
  });

  it('7. Manual MFS: customer reference attaches only to the manual attempt; finance approval needs it; gateway attempts cannot be hand-approved', async () => {
    const { quoteId, cookieName, cookie } = await guestQuote();
    const alice = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
    const finance = await login('finance@hoooplaaa.com', 'Finance#2026!');
    const bob = await login('bob@chittagongtraders.bd', 'CustomerB#2026!');
    const authz = (t: string) => ({ authorization: `Bearer ${t}` });

    // Gateway attempt first (dev simulator), as the customer chose card/MFS gateway.
    const ssl = await initiatePost(req('/api/checkout/initiate', { method: 'POST', headers: { ...authz(alice), cookie: `${cookieName}=${cookie!.value}` }, body: { quoteId, paymentMethod: 'sslcommerz' } }));
    expect(ssl.status).toBe(200);
    const sslJson = await ssl.json();
    const orderId = sslJson.orderId as string;

    // No manual attempt exists yet -> reference submission is refused (does not re-label the gateway attempt).
    const noManual = await manualPost(req('/api/checkout/manual-mfs', { method: 'POST', headers: authz(alice), body: { orderId, transactionReference: 'TRX-1' } }));
    expect(noManual.status).toBe(409);
    expect((await persistentDB.getPaymentsForOrder(orderId))[0].paymentStatus).toBe('initiated');

    // Finance cannot approve: no manual pending attempt with a reference.
    const verifyNoManual = await financeVerify(req('/api/admin/finance/verify', { method: 'POST', headers: authz(finance), body: { orderId, approved: true } }));
    expect(verifyNoManual.status).toBe(422);
    // Auth matrix on the finance route
    expect((await financeVerify(req('/api/admin/finance/verify', { method: 'POST', body: { orderId, approved: true } }))).status).toBe(401);
    expect((await financeVerify(req('/api/admin/finance/verify', { method: 'POST', headers: authz(alice), body: { orderId, approved: true } }))).status).toBe(403);

    // Customer opens a manual attempt, a different tenant cannot submit on it, owner can.
    const man = await initiatePost(req('/api/checkout/initiate', { method: 'POST', headers: authz(alice), body: { quoteId, paymentMethod: 'manual_mfs' } }));
    expect(man.status).toBe(200);
    const otherTenant = await manualPost(req('/api/checkout/manual-mfs', { method: 'POST', headers: authz(bob), body: { orderId, transactionReference: 'STOLEN' } }));
    expect(otherTenant.status).toBe(403);

    // Before a reference is submitted finance still cannot approve (attempt is only 'initiated')
    const early = await financeVerify(req('/api/admin/finance/verify', { method: 'POST', headers: authz(finance), body: { orderId, approved: true } }));
    expect(early.status).toBe(422);

    const submit = await manualPost(req('/api/checkout/manual-mfs', { method: 'POST', headers: authz(alice), body: { orderId, transactionReference: 'BKASH-9988', customerPhone: '01711111111' } }));
    expect(submit.status).toBe(200);
    expect((await persistentDB.getOrder(orderId))?.financialStatus).toBe('pending_verification');

    const approve = await financeVerify(req('/api/admin/finance/verify', { method: 'POST', headers: authz(finance), body: { orderId, approved: true, verifiedByStaffId: 'attacker-supplied' } }));
    expect(approve.status).toBe(200);
    const approved = await approve.json();
    expect(approved.verifiedByStaffId).toBe('00000000-0000-4000-a000-000000000003'); // from session, never body
    const final = await persistentDB.getOrder(orderId);
    expect(final?.financialStatus).toBe('paid');
    const payments = await persistentDB.getPaymentsForOrder(orderId);
    expect(payments.filter((p) => p.paymentStatus === 'verified').length).toBe(1);
    expect(payments.find((p) => p.paymentMethod === 'sslcommerz_sandbox')?.paymentStatus).toBe('initiated'); // untouched
  });

  it('8. SSLCOMMERZ callback: forged redirect cannot settle; with strict env a bare val_id (no S2S validation) is refused', async () => {
    const { quoteId, cookieName, cookie } = await guestQuote();
    const alice = await login('alice@dhakaheritage.bd', 'CustomerA#2026!');
    const ssl = await initiatePost(req('/api/checkout/initiate', { method: 'POST', headers: { authorization: `Bearer ${alice}`, cookie: `${cookieName}=${cookie!.value}` }, body: { quoteId, paymentMethod: 'sslcommerz' } }));
    const { orderId, attemptId } = await ssl.json();

    const forged = await sslCallback(req('/api/checkout/callback/sslcommerz', { method: 'POST', body: { tran_id: 'does-not-exist', val_id: 'X', status: 'VALID', amount: '1500.00', currency: 'BDT' } }));
    expect(forged.status).toBe(400);
    expect((await persistentDB.getOrder(orderId))?.financialStatus).toBe('unpaid');

    const prev = process.env.PAYMENT_MODE;
    process.env.PAYMENT_MODE = 'production'; // strict env: S2S validation mandatory, simulator impossible
    try {
      const bare = await sslCallback(req('/api/checkout/callback/sslcommerz', { method: 'POST', body: { tran_id: attemptId, val_id: 'BARE-VAL-ID', status: 'VALID', amount: '1500.00', currency: 'BDT' } }));
      expect(bare.status).toBe(400);
      const simulated = await sslCallback(req('/api/checkout/callback/sslcommerz', { method: 'POST', body: { tran_id: attemptId, val_id: 'SIM_123', status: 'VALID', amount: '1500.00', currency: 'BDT' } }));
      expect(simulated.status).toBe(400);
    } finally {
      if (prev === undefined) delete process.env.PAYMENT_MODE;
      else process.env.PAYMENT_MODE = prev;
    }
    expect((await persistentDB.getOrder(orderId))?.financialStatus).toBe('unpaid');
    const pg = await getInitializedTestPostgres();
    expect((await pg.query<{ c: number }>(`SELECT count(*)::int c FROM public.payment_events`)).rows[0].c).toBe(0);

    // Local simulator (non-strict, flag-enabled disposable DB only): amount must match the order
    const wrongAmount = await sslCallback(req('/api/checkout/callback/sslcommerz', { method: 'POST', body: { tran_id: attemptId, val_id: 'SIM_LOCAL_1', status: 'VALID', amount: '1.00', currency: 'BDT' } }));
    expect(wrongAmount.status).toBe(400);
    const good = await sslCallback(req('/api/checkout/callback/sslcommerz', { method: 'POST', body: { tran_id: attemptId, val_id: 'SIM_LOCAL_1', status: 'VALID', amount: '1500.00', currency: 'BDT' } }));
    expect(good.status).toBe(200);
    // IPN retry after success is idempotent
    const again = await sslCallback(req('/api/checkout/callback/sslcommerz', { method: 'POST', body: { tran_id: attemptId, val_id: 'SIM_LOCAL_1', status: 'VALID', amount: '1500.00', currency: 'BDT' } }));
    expect(again.status).toBe(200);
    expect((await pg.query<{ c: number }>(`SELECT count(*)::int c FROM public.payment_events`)).rows[0].c).toBe(1);
  });
});
