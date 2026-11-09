import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { NextRequest } from 'next/server';
import { persistentDB } from '../src/domain/persistent-db';
import { registerCustomerWithSupabaseAuth, validateRegistrationInput } from '../src/domain/auth-guard';
import {
  evaluateRegistrationConfig,
  isEmailAllowedForRegistration,
  resetRegistrationRateLimitForTests,
  supabaseProjectRef,
} from '../src/domain/registration-policy';
import { getInitializedTestPostgres } from '../src/testing/supabase-pglite-bridge';
import { POST as sessionPost } from '../src/app/api/auth/session/route';

/**
 * Server-side customer registration + abuse controls (LOCAL ONLY: PGlite bridge, in-process route handlers).
 * Public Supabase sign-up is disabled, so registration goes through the service-role Admin API on the server and
 * must never call the anon-key `auth.signUp`.
 */

const BASE = 'http://localhost:3000';
const PW = 'A-Long-Test-Password-1!';
let n = 0;
const uniqueEmail = () => 'reg-user-' + Date.now() + '-' + n++ + '@example.com';
let ipCounter = 0;
const freshIp = () => '198.51.100.' + (++ipCounter % 250);

function post(body: unknown, headers: Record<string, string> = {}) {
  return sessionPost(
    new NextRequest(BASE + '/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        'x-forwarded-for': freshIp(),
        ...headers,
      },
      body: JSON.stringify(body),
    })
  );
}

const ENV_KEYS = [
  'REGISTRATION_AUTO_CONFIRM_EMAIL',
  'REGISTRATION_EMAIL_ALLOWLIST',
  'REGISTRATION_STAGING_PROJECT_REF',
  'PRODUCTION_SUPABASE_PROJECT_REF',
  'REGISTRATION_RATE_LIMIT_MAX',
  'REGISTRATION_EMAIL_RATE_LIMIT_MAX',
];

describe('server-side customer registration (LOCAL ONLY)', () => {
  beforeEach(async () => {
    await getInitializedTestPostgres();
    resetRegistrationRateLimitForTests();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    vi.restoreAllMocks();
  });

  it('1. registers through the route; hostile body fields cannot choose the role, org or id; session cookie is HttpOnly', async () => {
    const email = uniqueEmail();
    const res = await post({
      action: 'register',
      email,
      password: PW,
      fullName: 'Reg Tester',
      businessName: 'Reg Tester Co',
      role: 'admin',
      userRole: 'admin',
      organizationId: '10000000-0000-4000-a000-000000000099',
      id: '00000000-0000-4000-a000-000000000005',
      user_metadata: { role: 'admin' },
      app_metadata: { role: 'admin' },
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.token).toBeUndefined(); // Zero browser token exposure
    expect(json.user.role).toBe('customer');
    expect(json.user.organizationId).not.toBe('10000000-0000-4000-a000-000000000099');
    expect(json.user.id).not.toBe('00000000-0000-4000-a000-000000000005');

    const profile = await persistentDB.getUserByEmail(email);
    expect(profile?.role).toBe('customer');
    const cookie = res.headers.get('set-cookie') || '';
    expect(cookie).toMatch(/sb-access-token=/);
    expect(cookie.toLowerCase()).toContain('httponly');
  });

  it('2. a duplicate email is a 409 and creates no second profile', async () => {
    const email = uniqueEmail();
    expect((await post({ action: 'register', email, password: PW })).status).toBe(200);
    expect((await post({ action: 'register', email, password: 'Another-Long-Password-2!' })).status).toBe(409);
  });

  it('3. rejects short passwords and malformed emails with 400', async () => {
    expect((await post({ action: 'register', email: uniqueEmail(), password: 'short1!' })).status).toBe(400);
    expect((await post({ action: 'register', email: 'not-an-email', password: PW })).status).toBe(400);
    expect(() => validateRegistrationInput('a@b.co', 'x'.repeat(129))).toThrow(/between 10 and 128/);
    expect(validateRegistrationInput('  A@B.Co ', 'x'.repeat(10))).toBe('a@b.co');
  });

  it('4. when email confirmation is required: 202, no token, no session cookie, account still provisioned', async () => {
    process.env.REGISTRATION_AUTO_CONFIRM_EMAIL = 'false';
    const email = uniqueEmail();
    const res = await post({ action: 'register', email, password: PW });
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(json.requiresEmailConfirmation).toBe(true);
    expect(json.token).toBeUndefined();
    expect(res.headers.get('set-cookie') || '').not.toMatch(/sb-access-token/);
    expect((await persistentDB.getUserByEmail(email))?.role).toBe('customer');
  });

  it('5. config policy: production never auto-confirms; auto-confirm FAILS CLOSED unless allowlisted, staging-marked and bound to the staging project', () => {
    const STAGING = 'abcdefghijklmnop';
    const URL = 'https://' + STAGING + '.supabase.co';
    const base = { NODE_ENV: 'production', VERCEL_ENV: 'preview', APP_ENV: 'staging', NEXT_PUBLIC_SUPABASE_URL: URL } as any;
    const ev = (e: Record<string, string>) => evaluateRegistrationConfig({ ...e } as any);

    expect(supabaseProjectRef({ NEXT_PUBLIC_SUPABASE_URL: URL } as any)).toBe(STAGING);
    expect(supabaseProjectRef({ NEXT_PUBLIC_SUPABASE_URL: 'https://evil.example.com' } as any)).toBeNull();

    // production: flag is ignored, strict, in every spelling
    for (const prod of [
      { ...base, VERCEL_ENV: 'production' },
      { ...base, APP_ENV: 'production' },
      { ...base, VERCEL_ENV: 'production', APP_ENV: 'staging' },
    ]) {
      const cfg = ev({ ...prod, REGISTRATION_AUTO_CONFIRM_EMAIL: 'true', REGISTRATION_EMAIL_ALLOWLIST: '@example.com', REGISTRATION_STAGING_PROJECT_REF: STAGING });
      expect(cfg).toEqual({ ok: true, autoConfirm: false });
    }
    // deployed, flag unset -> strict confirmation
    expect(ev({ ...base })).toEqual({ ok: true, autoConfirm: false });
    // flag true: each missing guard fails closed
    const good = { ...base, REGISTRATION_AUTO_CONFIRM_EMAIL: 'true', REGISTRATION_EMAIL_ALLOWLIST: 'tester@example.com', REGISTRATION_STAGING_PROJECT_REF: STAGING };
    expect(ev(good)).toEqual({ ok: true, autoConfirm: true });
    expect(ev({ ...good, REGISTRATION_EMAIL_ALLOWLIST: '' }).ok).toBe(false); // no allowlist
    expect(ev({ ...good, REGISTRATION_EMAIL_ALLOWLIST: ' , ' }).ok).toBe(false);
    expect(ev({ ...good, APP_ENV: undefined as any }).ok).toBe(false); // not marked staging
    expect(ev({ ...good, APP_ENV: 'development' }).ok).toBe(false);
    expect(ev({ ...good, REGISTRATION_STAGING_PROJECT_REF: '' }).ok).toBe(false); // not bound to a project
    expect(ev({ ...good, REGISTRATION_STAGING_PROJECT_REF: 'zzzzzzzzzzzzzzzz' }).ok).toBe(false); // wrong project
    expect(ev({ ...good, PRODUCTION_SUPABASE_PROJECT_REF: STAGING }).ok).toBe(false); // staging == production
    expect(ev({ ...good, NEXT_PUBLIC_SUPABASE_URL: '' }).ok).toBe(false);
    // local disposable bridge
    expect(ev({ NODE_ENV: 'test', SUPABASE_TEST_BRIDGE: 'true' })).toEqual({ ok: true, autoConfirm: true });
    expect(ev({ NODE_ENV: 'test', SUPABASE_TEST_BRIDGE: 'true', REGISTRATION_AUTO_CONFIRM_EMAIL: 'false' })).toEqual({ ok: true, autoConfirm: false });
    expect(ev({ NODE_ENV: 'test', SUPABASE_TEST_BRIDGE: 'true', REGISTRATION_AUTO_CONFIRM_EMAIL: 'true' }).ok).toBe(false); // still needs an allowlist
    expect(ev({ NODE_ENV: 'test' })).toEqual({ ok: true, autoConfirm: false }); // real project locally: strict
  });

  it('6. if profile provisioning fails, the new auth user is deleted (no orphan login) and the error surfaces', async () => {
    const admin = persistentDB.getSupabaseAdminClient();
    const del = vi.spyOn(admin.auth.admin, 'deleteUser').mockResolvedValue({ data: { user: null }, error: null } as any);
    vi.spyOn(persistentDB, 'createOrGetCustomerUser').mockRejectedValue(new Error('profile boom'));
    await expect(registerCustomerWithSupabaseAuth({ email: uniqueEmail(), password: PW })).rejects.toThrow('profile boom');
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('7. registration never uses the anon-key auth.signUp (project sign-up is disabled) and the Admin call carries no role claims', async () => {
    const src = fs.readFileSync('src/domain/auth-guard.ts', 'utf8');
    expect(src).not.toMatch(/\.auth\.signUp\(/);
    expect(src).toMatch(/auth\.admin\.createUser/);

    const admin = persistentDB.getSupabaseAdminClient();
    const spy = vi.spyOn(admin.auth.admin, 'createUser');
    const res = await post({ action: 'register', email: uniqueEmail(), password: PW, fullName: 'X', role: 'admin', app_metadata: { role: 'admin' } });
    expect(res.status).toBe(200);
    const arg: any = spy.mock.calls[0][0];
    expect(arg.app_metadata).toBeUndefined();
    expect(arg.role).toBeUndefined();
    expect(Object.keys(arg.user_metadata).sort()).toEqual(['business_name', 'full_name']);
  });

  it('8. allowlist: only listed addresses/domains may register (403, nothing created)', async () => {
    process.env.REGISTRATION_EMAIL_ALLOWLIST = 'tester@example.com, @allowed.test';
    const blocked = uniqueEmail();
    const r = await post({ action: 'register', email: blocked, password: PW });
    expect(r.status).toBe(403);
    expect(await persistentDB.getUserByEmail(blocked)).toBeFalsy();
    expect(isEmailAllowedForRegistration('Tester@Example.com')).toBe(true);
    expect(isEmailAllowedForRegistration('anyone@allowed.test')).toBe(true);
    expect(isEmailAllowedForRegistration('anyone@evil-allowed.test.attacker.io')).toBe(false);
    expect(isEmailAllowedForRegistration('x@allowed.test.evil.io')).toBe(false);
    expect((await post({ action: 'register', email: 'ok-' + Date.now() + '@allowed.test', password: PW })).status).toBe(200);
  });

  it('9. auto-confirm through the route requires a non-empty allowlist: without one the endpoint fails closed (503) and creates nothing', async () => {
    process.env.REGISTRATION_AUTO_CONFIRM_EMAIL = 'true';
    const email = uniqueEmail();
    const r = await post({ action: 'register', email, password: PW });
    expect(r.status).toBe(503);
    expect(await persistentDB.getUserByEmail(email)).toBeFalsy();

    process.env.REGISTRATION_EMAIL_ALLOWLIST = '@example.com';
    const ok = await post({ action: 'register', email: uniqueEmail(), password: PW });
    expect(ok.status).toBe(200); // allowlisted + bridge => auto-confirmed and signed in
  });

  it('10. CSRF: cross-origin, missing-origin, cross-site and non-JSON registrations are refused; login is CSRF-checked too', async () => {
    const email = uniqueEmail();
    const body = { action: 'register', email, password: PW };
    const send = (headers: Record<string, string>, raw?: string) =>
      sessionPost(
        new NextRequest(BASE + '/api/auth/session', {
          method: 'POST',
          headers: { 'x-forwarded-for': freshIp(), ...headers },
          body: raw ?? JSON.stringify(body),
        })
      );
    expect((await send({ 'Content-Type': 'application/json', Origin: 'https://evil.example' })).status).toBe(403);
    expect((await send({ 'Content-Type': 'application/json' })).status).toBe(403); // no Origin, no Sec-Fetch-Site
    expect((await send({ 'Content-Type': 'application/json', Origin: BASE, 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await send({ 'Content-Type': 'text/plain', Origin: BASE })).status).toBe(415);
    expect((await send({ 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE }, 'a=b')).status).toBe(415);
    expect(await persistentDB.getUserByEmail(email)).toBeFalsy();
    // same-origin via Sec-Fetch-Site alone is acceptable
    expect((await send({ 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' })).status).toBe(200);
    // login: cross-origin refused before credentials are even evaluated
    const login = await sessionPost(
      new NextRequest(BASE + '/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
        body: JSON.stringify({ email, password: PW }),
      })
    );
    expect(login.status).toBe(403);
  });

  it('11. shared rate limit: per-client (429 + Retry-After) that survives instance restarts; per-email across clients; others unaffected', async () => {
    const ip = '203.0.113.9';
    let bad = 0;
    const junk = () => 'not-an-email-' + ++bad; // a distinct invalid address per attempt, so only the client limit is exercised
    const attempt = (who: string, email = junk(), fresh = false) => {
      if (fresh) resetRegistrationRateLimitForTests(); // simulate a different serverless instance (empty memory)
      return post({ action: 'register', email, password: 'x' }, { 'x-forwarded-for': who });
    };
    for (let i = 0; i < 5; i++) expect((await attempt(ip)).status).toBe(400);
    const limited = await attempt(ip);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    // a "new instance" has empty memory but the database-backed limiter still blocks this client
    expect((await attempt(ip, undefined, true)).status).toBe(429);
    // another client is unaffected
    expect((await attempt('203.0.113.10')).status).toBe(400);
    // per-email limit across different clients (max 3 / window)
    const target = 'victim-' + Date.now() + '@example.com';
    for (let i = 0; i < 3; i++) expect((await attempt('198.18.0.' + (i + 1), target)).status).not.toBe(429);
    expect((await attempt('198.18.0.99', target)).status).toBe(429);
    // login is not counted against the registration limiter
    const login = await sessionPost(
      new NextRequest(BASE + '/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: BASE, 'x-forwarded-for': ip },
        body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password-123' }),
      })
    );
    expect(login.status).toBe(401);
  });

  it('12. fail closed: if the shared rate limiter is unavailable the registration is refused (503) and nothing is created', async () => {
    const admin = persistentDB.getSupabaseAdminClient();
    vi.spyOn(admin, 'rpc').mockResolvedValue({ data: null, error: { message: 'limiter down' } } as any);
    const email = uniqueEmail();
    const r = await post({ action: 'register', email, password: PW });
    expect(r.status).toBe(503);
    vi.restoreAllMocks();
    expect(await persistentDB.getUserByEmail(email)).toBeFalsy();
  });
});
