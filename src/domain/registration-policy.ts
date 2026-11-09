import type { NextRequest } from 'next/server';

/**
 * Registration abuse controls and the email-confirmation policy.
 *
 * Because customers are now created server-side with the Supabase Admin API (public sign-up stays disabled),
 * Supabase's own sign-up rate limits no longer apply to this endpoint, so the app enforces its own.
 */

/** True for a real production deployment. Nothing may relax email ownership verification there. */
export function isDeployedProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.APP_ENV === 'production';
}

/** Explicit staging marker: APP_ENV=staging on a non-production deployment. */
function isExplicitStaging(): boolean {
  return process.env.APP_ENV === 'staging' && !isDeployedProduction();
}

/** Plain local development / test run: no deployment markers and NODE_ENV is not production. */
function isLocalRun(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL_ENV && !process.env.APP_ENV;
}

/**
 * Whether a newly registered customer is marked email-confirmed immediately (skipping email ownership proof).
 *  - Production (VERCEL_ENV or APP_ENV = production): ALWAYS false, whatever the flag says.
 *  - REGISTRATION_AUTO_CONFIRM_EMAIL=true is honoured only on an explicitly marked staging deployment
 *    (APP_ENV=staging) or a local run. An unmarked production-like deployment can never be relaxed by it.
 *  - Default: local runs auto-confirm so the test harness can sign in; every deployed environment does not.
 */
export function shouldAutoConfirmRegistrationEmail(): boolean {
  if (isDeployedProduction()) return false;
  const flag = process.env.REGISTRATION_AUTO_CONFIRM_EMAIL;
  if (flag === 'false') return false;
  if (flag === 'true') return isExplicitStaging() || isLocalRun();
  return isLocalRun();
}

/**
 * Optional staging allowlist. REGISTRATION_EMAIL_ALLOWLIST is a comma-separated list of full addresses
 * ("tester@example.com") and/or domains ("@example.com"). When unset or empty, no restriction applies.
 */
export function isEmailAllowedForRegistration(email: string): boolean {
  const raw = (process.env.REGISTRATION_EMAIL_ALLOWLIST || '').trim();
  if (!raw) return true;
  const e = email.trim().toLowerCase();
  return raw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => (entry.startsWith('@') ? e.endsWith(entry) : e === entry));
}

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export function registrationRateLimitConfig(): { max: number; windowMs: number } {
  const max = Number(process.env.REGISTRATION_RATE_LIMIT_MAX);
  const windowMs = Number(process.env.REGISTRATION_RATE_LIMIT_WINDOW_SECONDS) * 1000;
  return {
    max: Number.isFinite(max) && max > 0 ? max : 5,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 15 * 60 * 1000,
  };
}

export function clientKey(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0].trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Best-effort fixed-window limiter, per server instance (serverless instances do not share memory, so this is a
 * brake on casual abuse, NOT a global guarantee; pair it with an edge/WAF rate limit before launch).
 * Returns the seconds to wait when limited, otherwise 0.
 */
export function checkRegistrationRateLimit(key: string, now = Date.now()): number {
  const { max, windowMs } = registrationRateLimitConfig();
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  b.count += 1;
  return b.count > max ? Math.max(1, Math.ceil((b.resetAt - now) / 1000)) : 0;
}

export function resetRegistrationRateLimitForTests(): void {
  buckets.clear();
}
