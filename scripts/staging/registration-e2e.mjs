// Controlled registration verification against a protected Preview + the live Supabase project.
// Writes ONE synthetic customer (an allowlisted address) and verifies Auth + PostgreSQL records.
//
//   PREVIEW_URL=https://<preview>.vercel.app REG_EMAIL=e2e-reg-01@example.com node scripts/staging/registration-e2e.mjs
//
// The Preview must have been deployed with REGISTRATION_AUTO_CONFIRM_EMAIL=true, REGISTRATION_EMAIL_ALLOWLIST (incl. REG_EMAIL),
// REGISTRATION_STAGING_PROJECT_REF and APP_ENV=staging. The registration rate limit is shared (database) and counts every
// registration attempt from this client, so this script deliberately keeps to 5 attempts before probing the limit.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PREVIEW_URL, app, keys, reporter, sb, sql, strongPassword } from './lib.mjs';

const R = reporter();
const { anon, service } = keys();
const email = process.env.REG_EMAIL || 'e2e-reg-01@example.com';
const blockedEmail = process.env.REG_BLOCKED_EMAIL || `not-allowlisted-${Date.now()}@example.com`;
const password = strongPassword();
const jar = path.join(os.tmpdir(), `hq-jar-${process.pid}.txt`);
const seen = []; // every response, scanned for secrets at the end
const A = (...a) => {
  const r = app(...a);
  seen.push(r.raw);
  return r;
};

// 0. access control
const open = spawnSync(`curl -s -o /dev/null -w "%{http_code}" "${PREVIEW_URL}/api/auth/session"`, { shell: true, encoding: 'utf8' });
R.check('Preview is access-controlled (unauthenticated request is not served)', ['401', '302', '403'].includes(open.stdout.trim()), open.stdout.trim());

// 1. a guest quote first, to test quote recovery after registration
const gq = A('POST', '/api/quote', { jar, body: { businessName: 'E2E Reg Coffee', businessProfile: { operatingModel: 'in_person_storefront', hasPhysicalStorefront: true }, selectedPlatformSkus: ['HI-SET-META'], selectedAddonSkus: [] } });
const quoteId = gq.json && gq.json.quote && gq.json.quote.id;
R.check('guest quote created with HttpOnly+Secure+SameSite=Strict, Path=/api cookie', gq.status === 200 && /set-cookie: hq_gc_[^;]+;(?=.*Path=\/api)(?=.*Secure)(?=.*HttpOnly)(?=.*SameSite=strict)/is.test(gq.headers), `${gq.status} ${quoteId}`);

// 2. registration attempts (each one counts toward the shared rate limit)
const reg = A('POST', '/api/auth/session', { body: { action: 'register', email, password, fullName: 'Staging E2E', businessName: 'E2E Reg Coffee', role: 'admin', userRole: 'admin', organizationId: '10000000-0000-4000-a000-000000000099', app_metadata: { role: 'admin' } } });
R.check('1. allowlisted customer registered (public signup is disabled)', reg.status === 200 && !!(reg.json && reg.json.token), `${reg.status} ${reg.status !== 200 ? reg.text.slice(0, 100) : ''}`);
R.check('3. role is strictly "customer" despite role/organizationId/app_metadata in the body', reg.json && reg.json.user && reg.json.user.role === 'customer', `role=${reg.json && reg.json.user && reg.json.user.role}`);
R.check('session cookie created: HttpOnly, Secure, SameSite=Lax', /set-cookie: sb-access-token=[^;]+;(?=.*HttpOnly)(?=.*Secure)(?=.*SameSite=lax)/is.test(reg.headers), '');
const dup = A('POST', '/api/auth/session', { body: { action: 'register', email, password } });
R.check('6a. duplicate registration -> 409', dup.status === 409, dup.status);
const bad1 = A('POST', '/api/auth/session', { body: { action: 'register', email: `short-${Date.now()}@example.com`, password: 'short1!' } });
R.check('6b. short password -> 400', bad1.status === 400, bad1.status);
const bad2 = A('POST', '/api/auth/session', { body: { action: 'register', email: 'not-an-email', password } });
R.check('6c. malformed email -> 400', bad2.status === 400, bad2.status);
const blocked = A('POST', '/api/auth/session', { body: { action: 'register', email: blockedEmail, password } });
R.check('allowlist: non-allowlisted address -> 403 and nothing created', blocked.status === 403, blocked.status);

// 3. CSRF / content type (these are rejected BEFORE the rate limiter, so they do not consume attempts)
const xo = A('POST', '/api/auth/session', { headers: { Origin: 'https://evil.example' }, body: { action: 'register', email, password } });
R.check('CSRF: cross-origin registration -> 403', xo.status === 403, xo.status);
const noOrigin = A('POST', '/api/auth/session', { headers: { Origin: null }, body: { action: 'register', email: blockedEmail, password } });
R.check('CSRF: registration with no Origin -> 403', noOrigin.status === 403, noOrigin.status);
const form = A('POST', '/api/auth/session', { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: { action: 'register' } });
R.check('non-JSON content type -> 415', form.status === 415, form.status);

// 4. login / session / logout
const wrong = A('POST', '/api/auth/session', { body: { email, password: 'wrong-password-123' } });
R.check('6d. invalid credentials -> 401', wrong.status === 401, wrong.status);
const login = A('POST', '/api/auth/session', { body: { email, password } });
const tok = login.json && login.json.token;
R.check('4a. login succeeds', login.status === 200 && !!tok, login.status);
const me = A('GET', '/api/auth/session', { token: tok });
R.check('4b. session endpoint resolves the customer', me.status === 200 && /"role":"customer"/.test(me.text), me.status);

// 5. quote recovery + checkout handoff
const unauth = A('GET', `/api/quote?id=${quoteId}`);
R.check('guest quote is unreadable without the capability cookie or a session', [401, 404].includes(unauth.status), unauth.status);
const claim = A('POST', '/api/checkout/initiate', { token: tok, jar, body: { quoteId, paymentMethod: 'manual_mfs' } });
const orderId = claim.json && (claim.json.orderId || (claim.json.order && claim.json.order.id));
R.check('4c. quote recovered and checkout started by the new customer (claim cookie + session)', claim.status === 200 && !!orderId, `${claim.status} ${orderId}`);
R.check('claim cookie cleared after the single-use claim', /set-cookie: hq_gc_[^;]+=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(claim.headers), '');
const owner = A('GET', `/api/quote?id=${quoteId}`, { token: tok });
R.check('4d. owner can read the recovered quote', owner.status === 200, owner.status);
R.check('checkout on an unknown quote -> 404', A('POST', '/api/checkout/initiate', { token: tok, body: { quoteId: 'QUO-DOES-NOT-EXIST', paymentMethod: 'manual_mfs' } }).status === 404);

// 6. role restrictions
R.check('6e. finance verify without auth -> 401', A('POST', '/api/admin/finance/verify', { body: { orderId: orderId || 'x', approved: true } }).status === 401);
R.check('6f. finance verify as customer -> 403', A('POST', '/api/admin/finance/verify', { token: tok, body: { orderId: orderId || 'x', approved: true } }).status === 403);
R.check('6g. admin order action as customer -> 403', A('POST', '/api/admin/orders', { token: tok, body: { orderId: orderId || 'x', action: 'deliver' } }).status === 403);
R.check('6h. admin order list as customer -> 403', A('GET', '/api/admin/orders', { token: tok }).status === 403);

// 7. rate limit (5 counted attempts so far from this client: reg, dup, short, malformed, blocked)
const limited = A('POST', '/api/auth/session', { body: { action: 'register', email: `rl-${Date.now()}@example.com`, password } });
R.check('shared rate limit: the 6th registration attempt in the window -> 429 with Retry-After', limited.status === 429 && /retry-after: \d+/i.test(limited.headers), limited.status);

// 8. Supabase Auth + PostgreSQL records
const rows = sql(`select u.id, u.email_confirmed_at is not null as confirmed, u.raw_app_meta_data->>'provider' as provider, p.role, p.organization_id, (select count(*) from public.user_profiles where organization_id = p.organization_id) as org_members, (select count(*) from public.user_profiles where role <> 'customer' and organization_id = p.organization_id) as staff_in_org from auth.users u join public.user_profiles p on p.id = u.id where u.email = '${email}'`);
const rec = rows[0] || {};
R.check('2a. account exists in Supabase Auth and public.user_profiles', !!rec.id, rec.id ? 'found' : 'missing');
R.check('2b. role in PostgreSQL is "customer"', rec.role === 'customer', rec.role);
R.check('2c. email confirmed (staging auto-confirm for the allowlisted address)', rec.confirmed === true, String(rec.confirmed));
R.check('2d. own organization, no staff in it', Number(rec.org_members) === 1 && Number(rec.staff_in_org) === 0, `members=${rec.org_members} staff=${rec.staff_in_org}`);
R.check('2e. non-allowlisted address was NOT created', sql(`select count(*)::int as n from auth.users where email = '${blockedEmail}'`)[0].n === 0);
const ord = sql(`select customer_id, financial_status from public.orders where order_code = '${orderId}'`)[0] || {};
R.check('order is owned by the new customer and unpaid', ord.customer_id === rec.id && ord.financial_status !== 'paid', `${ord.financial_status}`);
const ts = await sb('POST', '/auth/v1/signup', { key: anon, body: { email: 'direct-signup-probe@example.com', password: 'Probe-Test-123456!' } });
R.check('5. direct anon-key signup remains disabled', ts.status === 422 && /signup_disabled/.test(ts.text), `${ts.status} ${ts.json && ts.json.error_code}`);

// 9. logout must revoke the session server side
const lo = A('DELETE', '/api/auth/session', { token: tok });
R.check('4e. logout clears the session cookie', lo.status === 200 && /set-cookie: sb-access-token=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(lo.headers), lo.status);
const after = await sb('GET', '/auth/v1/user', { key: anon, token: tok });
R.check('4f. the access token is rejected by Supabase after logout (server-side revocation)', after.status >= 400, after.status);

// 10. secrets
const all = seen.join('\n');
R.check('7. service-role key absent from every response and header observed', !all.includes(service), `${(all.length / 1024).toFixed(0)} KB scanned`);
R.check('7. no sb_secret_ token or service_role JWT in any response', !/sb_secret_/.test(all) && !(all.match(/eyJ[\w-]{10,}\.[\w-]{20,}\.[\w-]{10,}/g) || []).some((t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch { return false; } }));

fs.writeFileSync(path.resolve('staging-registration-run.json'), JSON.stringify({ email, quoteId, orderId, userId: rec.id }));
R.done();
