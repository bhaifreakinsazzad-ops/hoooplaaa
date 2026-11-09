import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { persistentDB } from './persistent-db';

/**
 * Registration abuse controls and the email-confirmation policy.
 *
 * Customers are created server-side with the Supabase Admin API (public sign-up stays disabled), so Supabase's own
 * sign-up limits no longer apply to this endpoint and the app enforces its own:
 *   - fail-closed environment/config evaluation (never auto-confirm in production, never without an allowlist,
 *     never unless bound to the intended staging project);
 *   - strict same-origin + JSON content-type checks for registration;
 *   - a shared (database-backed, serverless-safe) rate limit per client and per email, plus a cheap in-memory
 *     pre-check. If the shared limiter is unavailable the request is REFUSED (fail closed), never allowed.
 */

export class RegistrationConfigError extends Error {
  constructor(public reason: string) {
    super(`Registration is unavailable: ${reason}`);
    this.name = 'RegistrationConfigError';
  }
}

type Env = NodeJS.ProcessEnv;

/** True for a real production deployment. Nothing may relax email ownership verification there. */
export function isDeployedProduction(env: Env = process.env): boolean {
  return env.VERCEL_ENV === 'production' || env.APP_ENV === 'production';
}

/** Plain local development / test run: no deployment markers and NODE_ENV is not production. */
function isLocalRun(env: Env): boolean {
  return env.NODE_ENV !== 'production' && !env.VERCEL_ENV && !env.APP_ENV;
}

export function parseRegistrationAllowlist(env: Env = process.env): string[] {
  return (env.REGISTRATION_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

/** Project ref from NEXT_PUBLIC_SUPABASE_URL (https://<ref>.supabase.co), or null. */
export function supabaseProjectRef(env: Env = process.env): string | null {
  try {
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL || '').hostname;
    const m = host.match(/^([a-z0-9]{10,})\.supabase\.(?:co|in)$/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export type RegistrationConfig = { ok: true; autoConfirm: boolean } | { ok: false; reason: string };

/**
 * Decides whether registration may run and whether the email is auto-confirmed.
 *  - Production (VERCEL_ENV or APP_ENV = production): autoConfirm is ALWAYS false, even if the flag is set.
 *  - REGISTRATION_AUTO_CONFIRM_EMAIL=true additionally requires, else the config FAILS CLOSED (503):
 *      a non-empty REGISTRATION_EMAIL_ALLOWLIST, and (outside the local test bridge) APP_ENV=staging on a
 *      non-production deployment bound to REGISTRATION_STAGING_PROJECT_REF == the project in NEXT_PUBLIC_SUPABASE_URL,
 *      which must not equal PRODUCTION_SUPABASE_PROJECT_REF when that is set.
 *  - Flag unset/false: no auto-confirm, except the disposable local test bridge.
 */
export function evaluateRegistrationConfig(env: Env = process.env): RegistrationConfig {
  const flag = env.REGISTRATION_AUTO_CONFIRM_EMAIL;
  const bridge = env.SUPABASE_TEST_BRIDGE === 'true';

  if (isDeployedProduction(env)) {
    if (flag === 'true') {
      console.error('[registration] REGISTRATION_AUTO_CONFIRM_EMAIL=true is ignored in production.');
    }
    return { ok: true, autoConfirm: false };
  }

  if (flag === 'true') {
    if (parseRegistrationAllowlist(env).length === 0) {
      return { ok: false, reason: 'auto-confirm requires a non-empty REGISTRATION_EMAIL_ALLOWLIST' };
    }
    if (!bridge) {
      if (env.APP_ENV !== 'staging') {
        return { ok: false, reason: 'auto-confirm is only permitted with APP_ENV=staging' };
      }
      const ref = supabaseProjectRef(env);
      const stagingRef = (env.REGISTRATION_STAGING_PROJECT_REF || '').trim().toLowerCase();
      if (!ref || !stagingRef) {
        return { ok: false, reason: 'auto-confirm requires REGISTRATION_STAGING_PROJECT_REF and a Supabase URL' };
      }
      if (ref !== stagingRef) {
        return { ok: false, reason: 'Supabase project does not match REGISTRATION_STAGING_PROJECT_REF' };
      }
      const prodRef = (env.PRODUCTION_SUPABASE_PROJECT_REF || '').trim().toLowerCase();
      if (prodRef && prodRef === ref) {
        return { ok: false, reason: 'staging project reference equals the production project reference' };
      }
    }
    return { ok: true, autoConfirm: true };
  }

  return { ok: true, autoConfirm: bridge && isLocalRun(env) && flag !== 'false' };
}

export function shouldAutoConfirmRegistrationEmail(env: Env = process.env): boolean {
  const cfg = evaluateRegistrationConfig(env);
  return cfg.ok && cfg.autoConfirm;
}

/**
 * Staging allowlist: comma-separated full addresses ("tester@example.com") and/or domains ("@example.com").
 * Unset/empty means no restriction (auto-confirm itself refuses to run without one).
 */
export function isEmailAllowedForRegistration(email: string, env: Env = process.env): boolean {
  const list = parseRegistrationAllowlist(env);
  if (list.length === 0) return true;
  const e = email.trim().toLowerCase();
  return list.some((entry) => (entry.startsWith('@') ? e.endsWith(entry) : e === entry));
}

/**
 * Strict same-origin check for registration (browsers always send Origin on a cross-site POST).
 * Requires an Origin matching the host, or Sec-Fetch-Site: same-origin, and a JSON content type (blocks plain
 * HTML form posts). Returns an error response, or null when the request is acceptable.
 */
export function rejectUnlessSameOriginJson(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;

  let sameOrigin = false;
  if (origin) {
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  } else if (fetchSite === 'same-origin') {
    sameOrigin = true;
  }
  if (fetchSite === 'cross-site') sameOrigin = false;

  if (!sameOrigin) {
    return NextResponse.json({ error: 'Forbidden: same-origin requests only.' }, { status: 403 });
  }
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Unsupported content type.' }, { status: 415 });
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------------------------------------------

export function clientKey(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0].trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}

function envInt(name: string, dflt: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : dflt;
}

export function registrationRateLimitConfig() {
  return {
    ipMax: envInt('REGISTRATION_RATE_LIMIT_MAX', 5),
    ipWindowSeconds: envInt('REGISTRATION_RATE_LIMIT_WINDOW_SECONDS', 900),
    emailMax: envInt('REGISTRATION_EMAIL_RATE_LIMIT_MAX', 3),
    emailWindowSeconds: envInt('REGISTRATION_EMAIL_RATE_LIMIT_WINDOW_SECONDS', 3600),
  };
}

interface Bucket {
  count: number;
  resetAt: number;
}
const localBuckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

/** Cheap per-instance pre-check (first line of defence only; the shared limiter is authoritative). */
export function checkLocalRateLimit(key: string, max: number, windowMs: number, now = Date.now()): number {
  if (localBuckets.size > MAX_BUCKETS) {
    for (const [k, b] of localBuckets) if (b.resetAt <= now) localBuckets.delete(k);
    if (localBuckets.size > MAX_BUCKETS) localBuckets.clear();
  }
  const b = localBuckets.get(key);
  if (!b || b.resetAt <= now) {
    localBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  b.count += 1;
  return b.count > max ? Math.max(1, Math.ceil((b.resetAt - now) / 1000)) : 0;
}

export function resetRegistrationRateLimitForTests(): void {
  localBuckets.clear();
}

function keyHash(kind: 'ip' | 'email', value: string): string {
  return crypto
    .createHash('sha256')
    .update(`registration:${kind}:${process.env.INTERNAL_AUDIT_SALT || ''}:${value}`)
    .digest('hex');
}

export type RateLimitOutcome =
  | { status: 'ok' }
  | { status: 'limited'; retryAfter: number }
  | { status: 'unavailable' };

/**
 * Shared, serverless-safe limit: per client (IP hash) and per email (hash), backed by the service-role-only
 * `hit_registration_rate_limit` function. Any failure of the shared limiter returns 'unavailable' so the caller
 * refuses the request (fail closed).
 */
export async function enforceRegistrationRateLimit(req: NextRequest, email: string): Promise<RateLimitOutcome> {
  const cfg = registrationRateLimitConfig();
  const ip = clientKey(req);
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const local = checkLocalRateLimit(`ip:${ip}`, cfg.ipMax, cfg.ipWindowSeconds * 1000);
  if (local > 0) return { status: 'limited', retryAfter: local };

  try {
    const admin = persistentDB.getSupabaseAdminClient();
    const checks: Array<[string, number, number]> = [[keyHash('ip', ip), cfg.ipWindowSeconds, cfg.ipMax]];
    if (normalizedEmail) checks.push([keyHash('email', normalizedEmail), cfg.emailWindowSeconds, cfg.emailMax]);

    let retryAfter = 0;
    for (const [hash, windowSeconds, max] of checks) {
      const { data, error } = await admin.rpc('hit_registration_rate_limit', {
        p_key_hash: hash,
        p_window_seconds: windowSeconds,
        p_max: max,
      });
      if (error || typeof data !== 'number') return { status: 'unavailable' };
      retryAfter = Math.max(retryAfter, data);
    }
    return retryAfter > 0 ? { status: 'limited', retryAfter } : { status: 'ok' };
  } catch {
    return { status: 'unavailable' };
  }
}
