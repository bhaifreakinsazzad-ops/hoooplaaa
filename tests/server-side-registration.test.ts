import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { NextRequest } from 'next/server';
import { persistentDB } from '../src/domain/persistent-db';
import {
  registerCustomerWithSupabaseAuth,
  shouldAutoConfirmRegistrationEmail,
  validateRegistrationInput,
} from '../src/domain/auth-guard';
import { isEmailAllowedForRegistration, resetRegistrationRateLimitForTests } from '../src/domain/registration-policy';
import { getInitializedTestPostgres } from '../src/testing/supabase-pglite-bridge';
import { POST as sessionPost } from '../src/app/api/auth/session/route';

/**
 * Server-side customer registration (LOCAL ONLY: PGlite bridge, in-process route handlers).
 * Public Supabase sign-up is disabled on the staging project, so registration must go through the
 * service-role Admin API on the server and must never call the anon-key `auth.signUp`.
 */

const BASE = 'http://localhost:3000';
let n = 0;
const uniqueEmail = () => `reg-user-${Date.now()}-${n++}@example.com`;

function post(body: unknown) {
  return sessionPost(
    new NextRequest(`${BASE}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

describe('server-side customer registration (LOCAL ONLY)', () => {
  beforeEach(async () => {
    await getInitializedTestPostgres();
    resetRegistrationRateLimitForTests();
  });
  afterEach(() => {
    delete process.env.REGISTRATION_AUTO_CONFIRM_EMAIL;
    delete process.env.REGISTRATION_EMAIL_ALLOWLIST;
    vi.restoreAllMocks();
  });

  it('1. registers through the route, forces role=customer even if the body asks for admin, and sets the session cookie', async () => {
    const email = uniqueEmail();
    const res = await post({
      action: 'register',
      email,
      password: 'A-Long-Test-Password-1!',
      fullName: 'Reg Tester',
      businessName: 'Reg Tester Co',
      role: 'admin',
      userRole: 'admin',
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.token).toBeTruthy();
    expect(json.user.role).toBe('customer');

    const profile = await persistentDB.getUserByEmail(email);
    expect(profile?.role).toBe('customer');
    expect(profile?.id).toBe(json.user.id);

    const cookie = res.headers.get('set-cookie') || '';
    expect(cookie).toMatch(/sb-access-token=/);
    expect(cookie.toLowerCase()).toContain('httponly');
  });

  it('2. a duplicate email is a 409 and creates no second profile', async () => {
    const email = uniqueEmail();
    const first = await post({ action: 'register', email, password: 'A-Long-Test-Password-1!' });
    expect(first.status).toBe(200);
    const second = await post({ action: 'register', email, password: 'Another-Long-Password-2!' });
    expect(second.status).toBe(409);
  });

  it('3. rejects short passwords and malformed emails with 400 before touching Auth', async () => {
    const short = await post({ action: 'register', email: uniqueEmail(), password: 'short1!' });
    expect(short.status).toBe(400);
    const badEmail = await post({ action: 'register', email: 'not-an-email', password: 'A-Long-Test-Password-1!' });
    expect(badEmail.status).toBe(400);
    expect(() => validateRegistrationInput('a@b.co', 'x'.repeat(129))).toThrow(/between 10 and 128/);
    expect(validateRegistrationInput('  A@B.Co ', 'x'.repeat(10))).toBe('a@b.co');
  });

  it('4. when email confirmation is required: 202, no token, no session cookie, account still provisioned', async () => {
    process.env.REGISTRATION_AUTO_CONFIRM_EMAIL = 'false';
    const email = uniqueEmail();
    const res = await post({ action: 'register', email, password: 'A-Long-Test-Password-1!' });
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(json.requiresEmailConfirmation).toBe(true);
    expect(json.token).toBeUndefined();
    expect(res.headers.get('set-cookie') || '').not.toMatch(/sb-access-token/);
    expect((await persistentDB.getUserByEmail(email))?.role).toBe('customer');
  });

  it('5. confirmation policy: production can NEVER auto-confirm; the flag only works on explicit staging or local runs', () => {
    const keys = ['NODE_ENV', 'APP_ENV', 'VERCEL_ENV', 'REGISTRATION_AUTO_CONFIRM_EMAIL'] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    const set = (env: Record<string, string | undefined>) => {
      for (const k of keys) delete (process.env as any)[k];
      for (const [k, v] of Object.entries(env)) if (v !== undefined) (process.env as any)[k] = v;
    };
    try {
      set({ NODE_ENV: 'test' });
      expect(shouldAutoConfirmRegistrationEmail()).toBe(true); // local default
      set({ NODE_ENV: 'test', REGISTRATION_AUTO_CONFIRM_EMAIL: 'false' });
      expect(shouldAutoConfirmRegistrationEmail()).toBe(false);
      // deployed, flag unset -> strict everywhere
      for (const env of [
        { NODE_ENV: 'production', APP_ENV: 'staging', VERCEL_ENV: 'preview' },
        { NODE_ENV: 'production', VERCEL_ENV: 'preview' },
        { NODE_ENV: 'production' },
        { NODE_ENV: 'production', APP_ENV: 'production', VERCEL_ENV: 'production' },
      ]) {
        set(env);
        expect(shouldAutoConfirmRegistrationEmail()).toBe(false);
      }
      // flag=true honoured ONLY on explicitly marked staging (or local)
      set({ NODE_ENV: 'production', APP_ENV: 'staging', VERCEL_ENV: 'preview', REGISTRATION_AUTO_CONFIRM_EMAIL: 'true' });
      expect(shouldAutoConfirmRegistrationEmail()).toBe(true);
      // ...never on production, however the production marker is expressed
      for (const env of [
        { NODE_ENV: 'production', VERCEL_ENV: 'production', REGISTRATION_AUTO_CONFIRM_EMAIL: 'true' },
        { NODE_ENV: 'production', APP_ENV: 'production', REGISTRATION_AUTO_CONFIRM_EMAIL: 'true' },
        { NODE_ENV: 'production', APP_ENV: 'staging', VERCEL_ENV: 'production', REGISTRATION_AUTO_CONFIRM_EMAIL: 'true' },
        { NODE_ENV: 'production', REGISTRATION_AUTO_CONFIRM_EMAIL: 'true' }, // unmarked production-like
        { NODE_ENV: 'production', VERCEL_ENV: 'preview', REGISTRATION_AUTO_CONFIRM_EMAIL: 'true' }, // preview without staging marker
      ]) {
        set(env);
        expect(shouldAutoConfirmRegistrationEmail()).toBe(false);
      }
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete (process.env as any)[k];
        else (process.env as any)[k] = saved[k];
      }
    }
  });

  it('6. if profile provisioning fails, the new auth user is deleted (no orphan login) and the error surfaces', async () => {
    const admin = persistentDB.getSupabaseAdminClient();
    const del = vi.spyOn(admin.auth.admin, 'deleteUser').mockResolvedValue({ data: { user: null }, error: null } as any);
    vi.spyOn(persistentDB, 'createOrGetCustomerUser').mockRejectedValue(new Error('profile boom'));
    await expect(
      registerCustomerWithSupabaseAuth({ email: uniqueEmail(), password: 'A-Long-Test-Password-1!' })
    ).rejects.toThrow('profile boom');
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('7. registration code never uses the anon-key auth.signUp (project sign-up is disabled)', () => {
    const src = fs.readFileSync('src/domain/auth-guard.ts', 'utf8');
    expect(src).not.toMatch(/\.auth\.signUp\(/);
    expect(src).toMatch(/auth\.admin\.createUser/);
  });

  it('8. staging email allowlist: when set, only listed addresses/domains may register (403-style 400, nothing created)', async () => {
    process.env.REGISTRATION_EMAIL_ALLOWLIST = 'tester@example.com, @allowed.test';
    try {
      const blocked = uniqueEmail();
      const r = await post({ action: 'register', email: blocked, password: 'A-Long-Test-Password-1!' });
      expect(r.status).toBe(400);
      expect(await persistentDB.getUserByEmail(blocked)).toBeFalsy();
      expect(isEmailAllowedForRegistration('Tester@Example.com')).toBe(true);
      expect(isEmailAllowedForRegistration('anyone@allowed.test')).toBe(true);
      expect(isEmailAllowedForRegistration('anyone@evil-allowed.test.attacker.io')).toBe(false);
      const ok = await post({ action: 'register', email: 'ok-' + Date.now() + '@allowed.test', password: 'A-Long-Test-Password-1!' });
      expect(ok.status).toBe(200);
    } finally {
      delete process.env.REGISTRATION_EMAIL_ALLOWLIST;
    }
    expect(isEmailAllowedForRegistration('anyone@anywhere.io')).toBe(true); // unset -> open
  });

  it('9. registration is rate limited per client: the 6th attempt in a window gets 429 with Retry-After', async () => {
    const from = (ip: string) =>
      sessionPost(
        new NextRequest(BASE + '/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
          body: JSON.stringify({ action: 'register', email: 'not-an-email', password: 'x' }),
        })
      );
    for (let i = 0; i < 5; i++) expect((await from('203.0.113.9')).status).toBe(400);
    const limited = await from('203.0.113.9');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await from('203.0.113.10')).status).toBe(400); // another client unaffected
    // login attempts are not counted against the registration limiter
    const login = await sessionPost(
      new NextRequest(BASE + '/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
        body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password-123' }),
      })
    );
    expect(login.status).toBe(401);
  });

});
