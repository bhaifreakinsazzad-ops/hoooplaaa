// Direct-to-Supabase negative tests (anon key and real user sessions). Needs seeded users (seed-users.mjs).
// Proves RLS/grants/storage behave as designed on the LIVE project. Writes nothing (every write attempt must be refused).
//
//   node scripts/staging/negative-tests.mjs
import { keys, loadCreds, reporter, sb, SUPABASE_URL } from './lib.mjs';

const R = reporter();
const { anon, service } = keys();
const C = loadCreds().users;
const denied = (s) => s === 401 || s === 403;
const U0 = '00000000-0000-0000-0000-000000000000';
const RPC = {
  settle_order_payment_paid: { p_order_id: 'x', p_payment_attempt_code: 'x', p_settlement_source: 'finance_manual', p_staff_id: U0 },
  convert_quote_to_active_order: { p_order_id: U0, p_quote_id: 'x', p_customer_id: U0, p_organization_id: U0, p_order_code: 'x', p_order_number: 'x', p_payload_json: {} },
  claim_guest_quote: { p_quote_id: 'x', p_customer_id: U0, p_organization_id: U0 },
  hit_registration_rate_limit: { p_key_hash: 'a'.repeat(32), p_window_seconds: 60, p_max: 5 },
};
const WRITE_TABLES = ['orders', 'payments', 'payment_events', 'audit_logs', 'quotes', 'quote_claims', 'platform_flags', 'registration_rate_limits'];

// ---- anon ----
for (const t of ['quote_claims', 'quotes', 'registration_rate_limits']) {
  const r = await sb('GET', `/rest/v1/${t}?select=*`, { key: anon });
  R.check(`anon cannot read ${t}`, denied(r.status) || (r.status === 200 && Array.isArray(r.json) && r.json.length === 0), r.status);
}
for (const t of WRITE_TABLES) {
  const r = await sb('POST', `/rest/v1/${t}`, { key: anon, body: {} });
  R.check(`anon cannot INSERT ${t}`, denied(r.status), r.status);
}
for (const [fn, body] of Object.entries(RPC)) {
  const r = await sb('POST', `/rest/v1/rpc/${fn}`, { key: anon, body });
  R.check(`anon cannot EXECUTE ${fn}`, (denied(r.status) || /42501/.test(r.text)) && !/PGRST202/.test(r.text), r.status);
  const c = await sb('POST', `/rest/v1/rpc/${fn}`, { key: service, body });
  R.check(`control: service_role reaches ${fn}`, !/PGRST202|42501|permission denied/.test(c.text), c.status);
}
const signup = await sb('POST', '/auth/v1/signup', { key: anon, body: { email: 'direct-signup-probe@example.com', password: 'Probe-Test-123456!' } });
R.check('direct anon-key signup is rejected (public signup disabled)', signup.status === 422 && /signup_disabled/.test(signup.text), `${signup.status} ${signup.json && signup.json.error_code}`);
const settings = await sb('GET', '/auth/v1/settings', { key: anon });
R.check('auth settings report disable_signup=true', settings.json && settings.json.disable_signup === true, `disable_signup=${settings.json && settings.json.disable_signup}`);
const lst = await sb('POST', '/storage/v1/object/list/order-assets', { key: anon, body: { prefix: '', limit: 5 } });
R.check('anon cannot list the private bucket', denied(lst.status) || lst.text === '[]', lst.status);
const pub = await fetch(`${SUPABASE_URL}/storage/v1/object/public/order-assets/x.png`);
R.check('private bucket has no public URL', pub.status >= 400, pub.status);

// ---- authenticated roles ----
const tokens = {};
for (const [k, u] of Object.entries(C)) {
  const r = await sb('POST', '/auth/v1/token?grant_type=password', { key: anon, body: { email: u.email, password: u.password } });
  tokens[k] = r.json && r.json.access_token;
  R.check(`login ${k}`, r.status === 200 && !!tokens[k], r.status);
}
const w = await sb('POST', '/auth/v1/token?grant_type=password', { key: anon, body: { email: C.customerA.email, password: 'definitely-wrong' } });
R.check('wrong password rejected', w.status === 400, w.status);

const mine = await sb('GET', '/rest/v1/user_profiles?select=id,role', { key: anon, token: tokens.customerA });
R.check('customerA sees only own profile', Array.isArray(mine.json) && mine.json.length === 1 && mine.json[0].id === C.customerA.id, `rows=${mine.json && mine.json.length}`);
const other = await sb('GET', `/rest/v1/user_profiles?id=eq.${C.customerB.id}&select=id`, { key: anon, token: tokens.customerA });
R.check('customerA cannot read customerB profile', Array.isArray(other.json) && other.json.length === 0, `rows=${other.json && other.json.length}`);
await sb('PATCH', `/rest/v1/user_profiles?id=eq.${C.customerA.id}`, { key: anon, token: tokens.customerA, body: { role: 'admin' } });
const roleNow = await sb('GET', `/rest/v1/user_profiles?id=eq.${C.customerA.id}&select=role`, { key: service, token: service });
R.check('customerA cannot self-promote to admin', roleNow.json[0].role === 'customer', `role=${roleNow.json[0].role}`);

for (const who of ['customerA', 'finance', 'engineer', 'admin']) {
  for (const t of WRITE_TABLES) {
    const r = await sb('POST', `/rest/v1/${t}`, { key: anon, token: tokens[who], body: {} });
    R.check(`${who} cannot INSERT ${t}`, denied(r.status), r.status);
  }
  for (const [tb, body] of [['orders', { financial_status: 'paid' }], ['orders', { order_status: 'delivered' }], ['payments', { payment_status: 'verified' }]]) {
    const p = await sb('PATCH', `/rest/v1/${tb}?id=not.is.null`, { key: anon, token: tokens[who], body });
    R.check(`${who} cannot PATCH ${tb} ${JSON.stringify(body)}`, denied(p.status), p.status);
    const d = await sb('DELETE', `/rest/v1/${tb}?id=not.is.null`, { key: anon, token: tokens[who] });
    R.check(`${who} cannot DELETE ${tb}`, denied(d.status), d.status);
  }
  for (const [fn, body] of Object.entries(RPC)) {
    const r = await sb('POST', `/rest/v1/rpc/${fn}`, { key: anon, token: tokens[who], body });
    R.check(`${who} cannot EXECUTE ${fn}`, (denied(r.status) || /42501/.test(r.text)) && !/PGRST202/.test(r.text), r.status);
  }
}
const up = await sb('POST', `/storage/v1/object/order-assets/${C.customerB.org}/probe.png`, { key: anon, token: tokens.customerA, body: 'x', raw: true, headers: { 'Content-Type': 'image/png' } });
R.check('customerA cannot upload into customerB org path (RLS, not MIME)', up.status >= 400 && !/invalid_mime/.test(up.text), up.status);
const lo = await sb('POST', '/auth/v1/logout', { key: anon, token: tokens.customerB });
R.check('logout -> 204', lo.status === 204, lo.status);
const after = await sb('GET', '/auth/v1/user', { key: anon, token: tokens.customerB });
R.check('token rejected after logout', after.status >= 400, after.status);
R.done();
