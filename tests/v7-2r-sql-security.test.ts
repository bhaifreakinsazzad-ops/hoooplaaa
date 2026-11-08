import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import crypto from 'crypto';
import { persistentDB, toDeterministicUuid } from '../src/domain/persistent-db';
import { calculateServerQuote } from '../src/domain/pricing-engine';
import { SSLCommerzAdapter } from '../src/domain/payment-adapter';
import { hashGuestClaimToken } from '../src/domain/guest-claim';
import { addBusinessDays, getBusinessCalendar } from '../src/domain/order-service';
import {
  getInitializedTestPostgres,
  resetTestPostgresData,
  supabasePgliteFetch,
} from '../src/testing/supabase-pglite-bridge';

/**
 * V7.2R SQL / RLS / settlement regression suite.
 *
 * LOCAL ONLY: runs against a disposable PostgreSQL 16 (PGlite) with REAL roles
 * (SET LOCAL ROLE anon | authenticated | service_role). It proves the migration SQL, not a deployed
 * Supabase project (see docs/development/V7_2R_CLAUDE_RELEASE_EVIDENCE.md for the cloud status).
 */

const ORG_A = '10000000-0000-4000-a000-000000000001';
const ORG_B = '10000000-0000-4000-a000-000000000002';
const CUST_A = '00000000-0000-4000-a000-000000000001';
const CUST_B = '00000000-0000-4000-a000-000000000002';
const FINANCE = '00000000-0000-4000-a000-000000000003';
const ENGINEER = '00000000-0000-4000-a000-000000000004';
const ADMIN = '00000000-0000-4000-a000-000000000005';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aqmyqezuoscpgqwtvblu.supabase.co';

const PRIVILEGED_FUNCTIONS = [
  'public.settle_order_payment_paid(text,text,text,text,text,jsonb)',
  'public.convert_quote_to_active_order(uuid,text,uuid,uuid,text,text,jsonb,text)',
  'public.claim_guest_quote(text,uuid,uuid,text)',
  'public.add_business_days(timestamptz,integer)',
  'public.is_business_day(date)',
];

function sslEvidence(attemptId: string, valId: string, amountMinor: number, overrides: Record<string, unknown> = {}) {
  return {
    providerValidated: true,
    status: 'VALID',
    tranId: attemptId,
    valId,
    amountMinor,
    currency: 'BDT',
    ...overrides,
  };
}

async function makeOrder(sku: string[], customer = CUST_A, org = ORG_A, name = 'Regression Co') {
  const quote = calculateServerQuote({
    businessId: org,
    businessName: name,
    businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true },
    selectedPlatformSkus: sku,
    selectedAddonSkus: [],
  });
  const saved = await persistentDB.saveQuote(quote, customer, org);
  const { order } = await persistentDB.createOrGetActiveOrderForQuote({
    quote: saved,
    customerId: customer,
    organizationId: org,
  });
  return order;
}

async function openAttempt(orderId: string, amountMinor: number, method = 'sslcommerz', status: any = 'initiated', extra: Record<string, unknown> = {}) {
  const id = `pay_t_${crypto.randomBytes(5).toString('hex')}`;
  await persistentDB.recordPaymentAttempt({
    id,
    orderId,
    paymentMethod: method,
    paymentStatus: status,
    amountMinor,
    currency: 'BDT',
    idempotencyKey: `idemp_${id}`,
    gatewayRawPayload: {},
    createdAt: new Date().toISOString(),
    ...extra,
  } as any);
  return id;
}

const asRole = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

describe('V7.2R — effective grants, definer hardening and direct-access denial (LOCAL ONLY, real PG roles)', () => {
  beforeAll(async () => {
    await resetTestPostgresData();
  });
  beforeEach(async () => {
    await resetTestPostgresData();
  });

  it('1. EXECUTE on privileged functions: anon/authenticated/PUBLIC denied, service_role granted (has_function_privilege)', async () => {
    const pg = await getInitializedTestPostgres();
    for (const fn of PRIVILEGED_FUNCTIONS) {
      for (const role of ['anon', 'authenticated']) {
        const r = await pg.query<{ ok: boolean }>(`SELECT has_function_privilege('${role}', '${fn}', 'EXECUTE') AS ok`);
        expect(r.rows[0].ok, `${role} must NOT execute ${fn}`).toBe(false);
      }
      const svc = await pg.query<{ ok: boolean }>(`SELECT has_function_privilege('service_role', '${fn}', 'EXECUTE') AS ok`);
      expect(svc.rows[0].ok, `service_role must execute ${fn}`).toBe(true);
      const acl = await pg.query<{ acl: string | null }>(`SELECT proacl::text AS acl FROM pg_proc WHERE oid = '${fn}'::regprocedure`);
      expect(acl.rows[0].acl ?? '', `PUBLIC (=X) must not be in ACL of ${fn}`).not.toMatch(/(^|[{,])=X/);
    }
    // RLS helper functions stay executable (policies need them) but return only the caller's own role/org.
    for (const role of ['anon', 'authenticated']) {
      const r = await pg.query<{ ok: boolean }>(`SELECT has_function_privilege('${role}', 'public.get_auth_role()', 'EXECUTE') AS ok`);
      expect(r.rows[0].ok).toBe(true);
    }
  });

  it('2. Every SECURITY DEFINER function in public pins a safe search_path', async () => {
    const pg = await getInitializedTestPostgres();
    const r = await pg.query<{ proname: string; cfg: string[] | null }>(
      `SELECT p.proname, p.proconfig AS cfg FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef`
    );
    expect(r.rows.length).toBeGreaterThanOrEqual(5);
    for (const row of r.rows) {
      const cfg = (row.cfg || []).join(';');
      expect(cfg, `${row.proname} must set search_path`).toMatch(/search_path=public, pg_temp/);
    }
  });

  it('3. No policy or function body relies on request.jwt.claim.role as an identity substitute', async () => {
    const pg = await getInitializedTestPostgres();
    const pol = await pg.query<{ n: string }>(
      `SELECT policyname AS n FROM pg_policies WHERE schemaname='public'
       AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%request.jwt.claim.role%'`
    );
    expect(pol.rows).toEqual([]);
    const fns = await pg.query<{ proname: string }>(
      `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.prokind='f' AND pg_get_functiondef(p.oid) LIKE '%request.jwt.claim.role%'`
    );
    expect(fns.rows).toEqual([]);
  });

  it('4. finance / admin / engineer JWT users cannot call privileged RPCs directly (403, not a bypass)', async () => {
    for (const id of [FINANCE, ADMIN, ENGINEER]) {
      const res = await supabasePgliteFetch(`${url}/rest/v1/rpc/settle_order_payment_paid`, {
        method: 'POST',
        headers: asRole(`mock-jwt-staff-${id}`),
        body: JSON.stringify({ p_order_id: 'x', p_payment_attempt_code: 'y', p_settlement_source: 'finance_manual', p_staff_id: id }),
      });
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('42501');
    }
    const claim = await supabasePgliteFetch(`${url}/rest/v1/rpc/claim_guest_quote`, {
      method: 'POST',
      headers: asRole(`mock-jwt-admin-${ADMIN}`),
      body: JSON.stringify({ p_quote_id: 'q', p_customer_id: ADMIN, p_organization_id: ORG_A }),
    });
    expect(claim.status).toBe(403);
  });

  it('5. Table privileges: authenticated/anon cannot write authoritative tables; anon has no access to orders/payments', async () => {
    const pg = await getInitializedTestPostgres();
    const guarded = ['quotes', 'orders', 'payments', 'payment_events', 'audit_logs', 'quote_claims'];
    for (const t of guarded) {
      for (const role of ['anon', 'authenticated']) {
        for (const priv of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
          const r = await pg.query<{ ok: boolean }>(`SELECT has_table_privilege('${role}', 'public.${t}', '${priv}') AS ok`);
          expect(r.rows[0].ok, `${role} must not ${priv} ${t}`).toBe(false);
        }
      }
    }
    for (const t of ['orders', 'payments', 'payment_events', 'audit_logs', 'quotes', 'quote_claims', 'order_intakes']) {
      const r = await pg.query<{ ok: boolean }>(`SELECT has_table_privilege('anon', 'public.${t}', 'SELECT') AS ok`);
      expect(r.rows[0].ok, `anon must not SELECT ${t}`).toBe(false);
    }
    for (const t of ['quote_claims', 'platform_flags', 'business_calendar_policy', 'business_holidays']) {
      const r = await pg.query<{ ok: boolean }>(`SELECT has_table_privilege('authenticated', 'public.${t}', 'SELECT') AS ok`);
      expect(r.rows[0].ok, `authenticated must not SELECT ${t}`).toBe(false);
    }
  });

  it('6. Direct client mutations of financial state are rejected under real roles (403)', async () => {
    const order = await makeOrder(['HI-SET-META']);
    const orderUuid = toDeterministicUuid(`order:${order.id}`);

    const patchOrder = await supabasePgliteFetch(`${url}/rest/v1/orders?id=eq.${orderUuid}`, {
      method: 'PATCH',
      headers: asRole(`mock-jwt-customer-${CUST_A}`),
      body: JSON.stringify({ financial_status: 'paid', order_status: 'ready_for_fulfillment' }),
    });
    expect(patchOrder.status).toBe(403);

    const forgedAudit = await supabasePgliteFetch(`${url}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: asRole(`mock-jwt-customer-${CUST_A}`),
      body: JSON.stringify({ log_code: 'forged', actor_role: 'admin', action: 'X', entity_type: 'order', entity_id: order.id }),
    });
    expect(forgedAudit.status).toBe(403);

    const delAudit = await supabasePgliteFetch(`${url}/rest/v1/audit_logs?log_code=eq.forged`, {
      method: 'DELETE',
      headers: asRole(`mock-jwt-staff-${ADMIN}`),
    });
    expect(delAudit.status).toBe(403);

    const finPatch = await supabasePgliteFetch(`${url}/rest/v1/payments?attempt_code=eq.x`, {
      method: 'PATCH',
      headers: asRole(`mock-jwt-finance-${FINANCE}`),
      body: JSON.stringify({ payment_status: 'verified' }),
    });
    expect(finPatch.status).toBe(403); // even finance cannot write payments directly (server-authoritative)

    const stillUnpaid = await persistentDB.getOrder(order.id);
    expect(stillUnpaid?.financialStatus).toBe('unpaid');
  });

  it('7. Guest quotes are NOT readable through direct PostgREST/RLS; owners and staff only', async () => {
    const guest = calculateServerQuote({
      businessId: 'biz-guest-rls',
      businessName: 'Private Guest Shop',
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });
    await persistentDB.saveQuote(guest, undefined, undefined, {
      tokenHash: hashGuestClaimToken('x'.repeat(40)),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });

    const anon = await supabasePgliteFetch(`${url}/rest/v1/quotes`, { method: 'GET', headers: { apikey: 'test-anon-key' } });
    expect(anon.status).toBe(403);

    const custB = await supabasePgliteFetch(`${url}/rest/v1/quotes?quote_code=eq.${guest.id}`, {
      method: 'GET',
      headers: asRole(`mock-jwt-customer-${CUST_B}`),
    });
    expect(custB.status).toBe(200);
    expect(await custB.json()).toEqual([]); // RLS hides it, no error signal

    const claims = await supabasePgliteFetch(`${url}/rest/v1/quote_claims`, { method: 'GET', headers: asRole(`mock-jwt-customer-${CUST_B}`) });
    expect(claims.status).toBe(403);

    const staff = await supabasePgliteFetch(`${url}/rest/v1/quotes?quote_code=eq.${guest.id}`, {
      method: 'GET',
      headers: asRole(`mock-jwt-staff-${ADMIN}`),
    });
    expect(((await staff.json()) as unknown[]).length).toBe(1);
  });

  it('8. Customer B cannot read Customer A order or payments through direct RLS reads', async () => {
    const order = await makeOrder(['HI-SET-META']);
    await openAttempt(order.id, order.totalMinor);
    const orderUuid = toDeterministicUuid(`order:${order.id}`);
    const b = await supabasePgliteFetch(`${url}/rest/v1/orders?id=eq.${orderUuid}`, { method: 'GET', headers: asRole(`mock-jwt-customer-${CUST_B}`) });
    expect(await b.json()).toEqual([]);
    const bp = await supabasePgliteFetch(`${url}/rest/v1/payments?order_id=eq.${orderUuid}`, { method: 'GET', headers: asRole(`mock-jwt-customer-${CUST_B}`) });
    expect(await bp.json()).toEqual([]);
    const a = await supabasePgliteFetch(`${url}/rest/v1/orders?id=eq.${orderUuid}`, { method: 'GET', headers: asRole(`mock-jwt-customer-${CUST_A}`) });
    expect(((await a.json()) as unknown[]).length).toBe(1);
  });
});

describe('V7.2R — guest claim capability (SQL layer)', () => {
  beforeEach(async () => {
    await resetTestPostgresData();
  });

  const guestQuote = (tag: string) =>
    calculateServerQuote({
      businessId: `biz-${tag}`,
      businessName: `Guest ${tag}`,
      businessProfile: { operatingModel: 'online_only_no_in_person' },
      selectedPlatformSkus: ['HI-SET-META'],
      selectedAddonSkus: [],
    });

  it('9. Raw claim secret is never stored: quote payload and quote_claims hold only a SHA-256 hash', async () => {
    const token = crypto.randomBytes(32).toString('base64url');
    const q = guestQuote('nostore');
    await persistentDB.saveQuote({ ...q, claimToken: token, claimTokenHash: 'leak' } as any, undefined, undefined, {
      tokenHash: hashGuestClaimToken(token),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    const pg = await getInitializedTestPostgres();
    const dump = await pg.query<{ t: string }>(
      `SELECT (SELECT string_agg(payload_json::text, '|') FROM public.quotes) || '|' ||
              (SELECT coalesce(string_agg(token_hash, '|'), '') FROM public.quote_claims) AS t`
    );
    expect(dump.rows[0].t).not.toContain(token);
    expect(dump.rows[0].t).not.toContain('claimToken');
    expect(dump.rows[0].t).toContain(hashGuestClaimToken(token));
    const fetched = await persistentDB.getQuote(q.id);
    expect(JSON.stringify(fetched)).not.toContain(token);
    expect(JSON.stringify(fetched)).not.toMatch(/claimToken/);
  });

  it('10. Claim requires the right token; expired, missing and replayed capabilities fail; claim is single-use', async () => {
    const token = crypto.randomBytes(32).toString('base64url');
    const q = guestQuote('lifecycle');
    await persistentDB.saveQuote(q, undefined, undefined, {
      tokenHash: hashGuestClaimToken(token),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    await expect(persistentDB.claimGuestQuote(q.id, CUST_A, ORG_A)).rejects.toThrow(/invalid guest quote claim/i);
    await expect(persistentDB.claimGuestQuote(q.id, CUST_A, ORG_A, 'wrong')).rejects.toThrow(/invalid guest quote claim/i);
    await persistentDB.claimGuestQuote(q.id, CUST_A, ORG_A, token);
    // After claim the secret is destroyed: another tenant with the SAME secret is rejected
    await expect(persistentDB.claimGuestQuote(q.id, CUST_B, ORG_B, token)).rejects.toThrow(/Cross-tenant violation/i);
    const pg = await getInitializedTestPostgres();
    const row = await pg.query<{ token_hash: string | null; claimed_at: string | null }>(`SELECT token_hash, claimed_at FROM public.quote_claims`);
    expect(row.rows[0].token_hash).toBeNull();
    expect(row.rows[0].claimed_at).not.toBeNull();

    // Expiry
    const q2 = guestQuote('expired');
    await persistentDB.saveQuote(q2, undefined, undefined, {
      tokenHash: hashGuestClaimToken(token),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(persistentDB.claimGuestQuote(q2.id, CUST_A, ORG_A, token)).rejects.toThrow(/expired/i);
    expect(await persistentDB.verifyGuestQuoteClaim(q2.id, token)).toBe(false);
  });

  it('11. Simultaneous claims by two tenants: exactly one wins (row lock), the other is rejected', async () => {
    const token = crypto.randomBytes(32).toString('base64url');
    const q = guestQuote('race');
    await persistentDB.saveQuote(q, undefined, undefined, {
      tokenHash: hashGuestClaimToken(token),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    const results = await Promise.allSettled([
      persistentDB.claimGuestQuote(q.id, CUST_A, ORG_A, token),
      persistentDB.claimGuestQuote(q.id, CUST_B, ORG_B, token),
      persistentDB.claimGuestQuote(q.id, CUST_B, ORG_B, token),
    ]);
    const wins = results.filter((r) => r.status === 'fulfilled');
    // Customer B's two requests may both succeed only if B won (idempotent for the SAME owner); never A and B.
    const owners = new Set(wins.map((w) => (w as PromiseFulfilledResult<any>).value.customerId));
    expect(owners.size).toBe(1);
    const final = await persistentDB.getQuote(q.id);
    expect([CUST_A, CUST_B]).toContain(final?.customerId);
    expect([ORG_A, ORG_B]).toContain(final?.organizationId);
  });

  it('12. A convert_quote_to_active_order call cannot take over a guest quote without the capability', async () => {
    const q = guestQuote('convert');
    await persistentDB.saveQuote(q, undefined, undefined, {
      tokenHash: hashGuestClaimToken('s'.repeat(43)),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    await expect(
      persistentDB.createOrGetActiveOrderForQuote({ quote: q, customerId: CUST_B, organizationId: ORG_B })
    ).rejects.toThrow(/Unauthorized/i);
    const after = await persistentDB.getQuote(q.id);
    expect(after?.customerId).toBeUndefined();
  });
});

describe('V7.2R — atomic settlement, replay, manual approval and SLA (SQL layer)', () => {
  beforeEach(async () => {
    await resetTestPostgresData();
  });

  it('13. Gateway settlement without provider S2S validation evidence is rejected; nothing is half-written', async () => {
    const order = await makeOrder(['HI-SET-META']);
    const attempt = await openAttempt(order.id, order.totalMinor);
    const base = { orderId: order.id, paymentAttemptId: attempt, source: 'sslcommerz_s2s_validated' as const, providerValId: 'V-1' };

    await expect(persistentDB.settleOrderPaymentPaid({ ...base, evidencePayload: {} })).rejects.toThrow(/server-to-server validation evidence/i);
    await expect(
      persistentDB.settleOrderPaymentPaid({ ...base, evidencePayload: sslEvidence(attempt, 'V-1', order.totalMinor, { providerValidated: false }) })
    ).rejects.toThrow(/server-to-server validation evidence/i);
    await expect(
      persistentDB.settleOrderPaymentPaid({ ...base, evidencePayload: sslEvidence('other_attempt', 'V-1', order.totalMinor) })
    ).rejects.toThrow(/does not match/i);
    await expect(
      persistentDB.settleOrderPaymentPaid({ ...base, evidencePayload: sslEvidence(attempt, 'V-1', order.totalMinor - 1) })
    ).rejects.toThrow(/does not match/i);
    await expect(
      persistentDB.settleOrderPaymentPaid({ ...base, evidencePayload: sslEvidence(attempt, 'V-1', order.totalMinor, { status: 'FAILED' }) })
    ).rejects.toThrow(/does not match/i);

    const pg = await getInitializedTestPostgres();
    const ev = await pg.query<{ c: number }>(`SELECT count(*)::int AS c FROM public.payment_events`);
    expect(ev.rows[0].c).toBe(0);
    expect((await persistentDB.getPaymentsForOrder(order.id))[0].paymentStatus).toBe('initiated');
    expect((await persistentDB.getOrder(order.id))?.financialStatus).toBe('unpaid');
  });

  it('14. Simulated settlement is rejected by the DATABASE when allow_simulated_payments is false (staging/production default)', async () => {
    const pg = await getInitializedTestPostgres();
    const flag = await pg.query<{ v: boolean }>(`SELECT bool_value AS v FROM public.platform_flags WHERE flag_key='allow_simulated_payments'`);
    expect(flag.rows[0].v).toBe(true); // test harness only
    await pg.exec(`UPDATE public.platform_flags SET bool_value=false WHERE flag_key='allow_simulated_payments'`);
    try {
      const order = await makeOrder(['HI-SET-META']);
      const attempt = await openAttempt(order.id, order.totalMinor);
      await expect(
        persistentDB.settleOrderPaymentPaid({
          orderId: order.id,
          paymentAttemptId: attempt,
          source: 'local_simulator',
          providerValId: 'SIM_X',
          evidencePayload: sslEvidence(attempt, 'SIM_X', order.totalMinor, { providerValidated: false }),
        })
      ).rejects.toThrow(/Simulated payment settlement is disabled/i);
    } finally {
      await pg.exec(`UPDATE public.platform_flags SET bool_value=true WHERE flag_key='allow_simulated_payments'`);
    }
    // The shipped migration default is OFF
    const mig = await import('fs').then((fs) =>
      fs.readFileSync('supabase/migrations/20261110000000_v7_2r_security_hardening.sql', 'utf8')
    );
    expect(mig).toMatch(/VALUES \('allow_simulated_payments', false\)/);
  });

  it('15. Provider validation id replay across a different order is rejected; same-order replay is idempotent with ONE event/audit row', async () => {
    const o1 = await makeOrder(['HI-SET-META'], CUST_A, ORG_A, 'One');
    const a1 = await openAttempt(o1.id, o1.totalMinor);
    const args1 = { orderId: o1.id, paymentAttemptId: a1, source: 'sslcommerz_s2s_validated' as const, providerValId: 'VAL-SHARED', evidencePayload: sslEvidence(a1, 'VAL-SHARED', o1.totalMinor) };

    const concurrent = await Promise.all([1, 2, 3, 4, 5].map(() => persistentDB.settleOrderPaymentPaid(args1)));
    for (const c of concurrent) expect(c.order.financialStatus).toBe('paid');

    const pg = await getInitializedTestPostgres();
    expect((await pg.query<{ c: number }>(`SELECT count(*)::int c FROM public.payment_events`)).rows[0].c).toBe(1);
    expect((await pg.query<{ c: number }>(`SELECT count(*)::int c FROM public.audit_logs WHERE action='PAYMENT_SETTLED_ORDER_PAID'`)).rows[0].c).toBe(1);

    const o2 = await makeOrder(['HI-SET-LINKEDIN'], CUST_B, ORG_B, 'Two');
    const a2 = await openAttempt(o2.id, o2.totalMinor);
    await expect(
      persistentDB.settleOrderPaymentPaid({ orderId: o2.id, paymentAttemptId: a2, source: 'sslcommerz_s2s_validated', providerValId: 'VAL-SHARED', evidencePayload: sslEvidence(a2, 'VAL-SHARED', o2.totalMinor) })
    ).rejects.toThrow();
    expect((await persistentDB.getOrder(o2.id))?.financialStatus).toBe('unpaid');
  });

  it('16. Manual approval: needs a PENDING manual_mfs attempt WITH a submitted reference and a real finance/admin profile', async () => {
    const order = await makeOrder(['HI-SET-META']);
    const manualInitiated = await openAttempt(order.id, order.totalMinor, 'manual_mfs', 'initiated');
    const common = { orderId: order.id, source: 'finance_manual' as const };

    // initiated (no reference submitted) -> rejected
    await expect(persistentDB.settleOrderPaymentPaid({ ...common, paymentAttemptId: manualInitiated, verifiedByStaffId: FINANCE })).rejects.toThrow(/pending manual_mfs/i);

    // submit reference -> pending_verification
    await persistentDB.recordPaymentAttempt({
      ...(await persistentDB.getPaymentByAttemptId(manualInitiated))!,
      paymentStatus: 'pending_verification',
      manualTrxReference: 'BKASH-TRX-12345',
    });

    // customer / engineer / unknown staff ids are not authorised
    for (const bad of [CUST_A, ENGINEER, crypto.randomUUID()]) {
      await expect(persistentDB.settleOrderPaymentPaid({ ...common, paymentAttemptId: manualInitiated, verifiedByStaffId: bad })).rejects.toThrow(/not authorised/i);
    }
    await expect(persistentDB.settleOrderPaymentPaid({ ...common, paymentAttemptId: manualInitiated })).rejects.toThrow(/finance\/admin staff id/i);

    const ok = await persistentDB.settleOrderPaymentPaid({ ...common, paymentAttemptId: manualInitiated, verifiedByStaffId: FINANCE, evidencePayload: { note: 'statement matched' } });
    expect(ok.order.financialStatus).toBe('paid');
    expect(ok.payment.verifiedByFinanceId).toBe(FINANCE);
  });

  it('17. A gateway attempt can never be settled through the manual/finance path', async () => {
    const order = await makeOrder(['HI-SET-META']);
    const ssl = await openAttempt(order.id, order.totalMinor, 'sslcommerz', 'initiated', { manualTrxReference: 'FAKE-REF' });
    await expect(
      persistentDB.settleOrderPaymentPaid({ orderId: order.id, paymentAttemptId: ssl, source: 'finance_manual', verifiedByStaffId: FINANCE })
    ).rejects.toThrow(/pending manual_mfs/i);
    // and a manual attempt cannot be settled as a gateway payment
    const order2 = await makeOrder(['HI-SET-LINKEDIN'], CUST_B, ORG_B);
    const manual = await openAttempt(order2.id, order2.totalMinor, 'manual_mfs', 'pending_verification', { manualTrxReference: 'REF' });
    await expect(
      persistentDB.settleOrderPaymentPaid({ orderId: order2.id, paymentAttemptId: manual, source: 'sslcommerz_s2s_validated', providerValId: 'V', evidencePayload: sslEvidence(manual, 'V', order2.totalMinor) })
    ).rejects.toThrow(/requires an SSLCOMMERZ payment attempt/i);
  });

  it('18. One open attempt per (order, method) and one verified payment per order are DB-enforced', async () => {
    const order = await makeOrder(['HI-SET-META']);
    await openAttempt(order.id, order.totalMinor);
    await expect(openAttempt(order.id, order.totalMinor)).rejects.toThrow();
    const payments = await persistentDB.getPaymentsForOrder(order.id);
    expect(payments.length).toBe(1);
  });

  it('19. Logical payment session: repeated and concurrent initiations re-use ONE attempt (no Date.now keys)', async () => {
    const order = await makeOrder(['HI-SET-META']);
    const adapter = new SSLCommerzAdapter();
    const first = await adapter.initiatePayment(order);
    const again = await adapter.initiatePayment(order);
    expect(again.attemptId).toBe(first.attemptId);
    expect(again.gatewayUrl).toBe(first.gatewayUrl);
    expect(first.idempotencyKey).toBe(`idemp_${order.id}_sslcommerz_sandbox_0`);

    const results = await Promise.allSettled([1, 2, 3, 4].map(() => adapter.initiatePayment(order)));
    for (const r of results) {
      if (r.status === 'fulfilled') expect(r.value.attemptId).toBe(first.attemptId);
    }
    expect((await persistentDB.getPaymentsForOrder(order.id)).length).toBe(1);

    // Concurrent FIRST initiation on a fresh order also collapses to a single attempt
    const order2 = await makeOrder(['HI-SET-LINKEDIN'], CUST_B, ORG_B, 'Fresh');
    const burst = await Promise.allSettled([1, 2, 3, 4, 5].map(() => adapter.initiatePayment(order2)));
    const ids = new Set(burst.filter((b) => b.status === 'fulfilled').map((b) => (b as PromiseFulfilledResult<any>).value.attemptId));
    expect(ids.size).toBe(1);
    expect((await persistentDB.getPaymentsForOrder(order2.id)).length).toBe(1);
  });

  it('20. SLA starts at settlement ONLY when intake is already complete; deadline = policy business days per SKU', async () => {
    const pg = await getInitializedTestPostgres();
    const admin = persistentDB.getSupabaseAdminClient();
    const cases: Array<{ skus: string[]; days: number }> = [
      { skus: ['HI-SET-LINKEDIN'], days: 1 },
      { skus: ['HI-SET-META'], days: 2 },
      { skus: ['HI-BUNDLE-3'], days: 4 },
    ];
    let i = 0;
    for (const c of cases) {
      const cust = i % 2 === 0 ? CUST_A : CUST_B;
      const org = i % 2 === 0 ? ORG_A : ORG_B;
      const order = await makeOrder(c.skus, cust, org, `SLA ${i++}`);
      const orderUuid = toDeterministicUuid(`order:${order.id}`);
      const attempt = await openAttempt(order.id, order.totalMinor);

      // Intake complete BEFORE payment
      await admin.from('order_intakes').insert({
        order_id: orderUuid, submitted_by: cust, business_name: 'X', contact_email: 'x@x.bd', contact_whatsapp: '0170',
        target_audience: 'y', partner_invite_status: 'sent', payload_json: {},
      });
      await admin.from('orders').update({ intake_status: 'completed' }).eq('id', orderUuid);

      const settled = await persistentDB.settleOrderPaymentPaid({
        orderId: order.id, paymentAttemptId: attempt, source: 'sslcommerz_s2s_validated', providerValId: `V-SLA-${i}`,
        evidencePayload: sslEvidence(attempt, `V-SLA-${i}`, order.totalMinor),
      });
      expect(settled.order.status).toBe('ready_for_fulfillment');
      const row = await pg.query<{ s: string; d: string; expected: string }>(
        `SELECT sla_started_at::text s, sla_deadline_at::text d, public.add_business_days(sla_started_at, ${c.days})::text expected
         FROM public.orders WHERE id = '${orderUuid}'`
      );
      expect(row.rows[0].s).toBeTruthy();
      expect(row.rows[0].d).toBe(row.rows[0].expected);
      // SQL and TypeScript implement the SAME calendar
      const ts = addBusinessDays(new Date(row.rows[0].s), c.days, getBusinessCalendar());
      expect(new Date(row.rows[0].d).toISOString()).toBe(ts.toISOString());
    }
  });

  it('21. SQL add_business_days equals TypeScript addBusinessDays across weekend, cutoff, early-morning and boundary instants', async () => {
    const pg = await getInitializedTestPostgres();
    const cal = getBusinessCalendar();
    const instants = [
      '2026-11-08T05:00:00Z', // Sunday morning local
      '2026-11-12T03:00:00Z', // Thursday 09:00 local
      '2026-11-12T10:59:59Z', // Thursday 16:59:59 local (before cutoff)
      '2026-11-12T11:00:00Z', // Thursday 17:00:00 local (at cutoff)
      '2026-11-12T20:00:00Z', // Friday 02:00 local (weekend, policy Fri/Sat)
      '2026-11-13T09:00:00Z', // Friday afternoon
      '2026-11-14T08:30:00Z', // Saturday
      '2026-11-15T01:00:00Z', // Sunday 07:00 local (before opening)
      '2026-12-31T17:59:00Z', // year boundary
    ];
    for (const iso of instants) {
      for (const n of [1, 2, 4]) {
        const sql = await pg.query<{ r: string }>(`SELECT public.add_business_days('${iso}'::timestamptz, ${n})::text AS r`);
        expect(new Date(sql.rows[0].r).toISOString(), `${iso} +${n}`).toBe(addBusinessDays(new Date(iso), n, cal).toISOString());
      }
    }
  });

  it('22. SLA calendar policy is explicit and still flagged PROVISIONAL_UNAPPROVED (owner decision outstanding)', async () => {
    const pg = await getInitializedTestPostgres();
    const r = await pg.query<{ policy_status: string; weekend_days: number[]; timezone: string }>(
      `SELECT policy_status, weekend_days, timezone FROM public.business_calendar_policy`
    );
    expect(r.rows[0].timezone).toBe('Asia/Dhaka');
    expect(r.rows[0].policy_status).toBe('PROVISIONAL_UNAPPROVED');
    expect(getBusinessCalendar().policyStatus).toBe('PROVISIONAL_UNAPPROVED');
  });
});
