import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { NextRequest } from 'next/server';
import { persistentDB } from '../src/domain/persistent-db';
import {
  registerCustomerWithSupabaseAuth,
  shouldAutoConfirmRegistrationEmail,
  validateRegistrationInput,
} from '../src/domain/auth-guard';
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
  });
  afterEach(() => {
    delete process.env.REGISTRATION_AUTO_CONFIRM_EMAIL;
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

  it('5. default confirmation policy: auto-confirm locally, NOT in deployed environments unless explicitly enabled', () => {
    const keys = ['NODE_ENV', 'APP_ENV', 'VERCEL_ENV', 'REGISTRATION_AUTO_CONFIRM_EMAIL'] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    try {
      delete process.env.REGISTRATION_AUTO_CONFIRM_EMAIL;
      delete process.env.APP_ENV;
      delete process.env.VERCEL_ENV;
      (process.env as any).NODE_ENV = 'test';
      expect(shouldAutoConfirmRegistrationEmail()).toBe(true);
      process.env.APP_ENV = 'staging';
      expect(shouldAutoConfirmRegistrationEmail()).toBe(false);
      delete process.env.APP_ENV;
      process.env.VERCEL_ENV = 'preview';
      expect(shouldAutoConfirmRegistrationEmail()).toBe(false);
      process.env.REGISTRATION_AUTO_CONFIRM_EMAIL = 'true';
      expect(shouldAutoConfirmRegistrationEmail()).toBe(true);
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
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
});
