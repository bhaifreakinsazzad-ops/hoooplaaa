import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Guest quote handoff capability (V7.2R).
 *
 * A guest who configures a quote receives an opaque 256-bit random secret in an
 * HttpOnly, SameSite=Strict, path-scoped cookie. Only SHA-256(secret) is stored
 * server-side (public.quote_claims, service_role only) with a short expiry and
 * single use. The secret is never placed in a URL, JSON body, localStorage,
 * sessionStorage, analytics or logs, and the quote id alone never authorises
 * reading or claiming a guest quote.
 */

export const GUEST_CLAIM_TTL_SECONDS = 30 * 60;
const COOKIE_PATH = '/api';

export function generateGuestClaim(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashGuestClaimToken(token) };
}

export function hashGuestClaimToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function guestClaimCookieName(quoteId: string): string {
  // Cookie names must be token-safe; derive a short stable name from the quote id.
  return `hq_gc_${crypto.createHash('sha256').update(quoteId).digest('hex').slice(0, 20)}`;
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function isSecureRequest(req: NextRequest): boolean {
  const forwarded = req.headers.get('x-forwarded-proto');
  return req.nextUrl.protocol === 'https:' || forwarded?.split(',')[0].trim() === 'https';
}

export function readGuestClaimToken(req: NextRequest, quoteId: string): string | undefined {
  const value = req.cookies.get(guestClaimCookieName(quoteId))?.value;
  return value && value.length >= 32 && value.length <= 128 ? value : undefined;
}

export function setGuestClaimCookie(
  res: NextResponse,
  req: NextRequest,
  quoteId: string,
  token: string
): void {
  res.cookies.set(guestClaimCookieName(quoteId), token, {
    httpOnly: true,
    secure: isSecureRequest(req), // HTTPS in staging/production; plain http only for local development
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: GUEST_CLAIM_TTL_SECONDS,
  });
}

export function clearGuestClaimCookie(res: NextResponse, req: NextRequest, quoteId: string): void {
  res.cookies.set(guestClaimCookieName(quoteId), '', {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: 0,
  });
}

/**
 * CSRF / origin protection for cookie-authenticated, state-changing endpoints.
 * Browsers always send `Origin` on cross-origin POST; a mismatching Origin or an
 * explicit cross-site fetch-metadata signal is rejected. Non-browser clients cannot
 * ride a victim's cookies, so a missing Origin is tolerated.
 */
export function rejectCrossOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;

  let mismatch = false;
  if (origin) {
    try {
      mismatch = new URL(origin).host !== host;
    } catch {
      mismatch = true;
    }
  }
  if (fetchSite === 'cross-site') mismatch = true;

  if (mismatch) {
    return NextResponse.json({ error: 'Forbidden: cross-origin request rejected.' }, { status: 403 });
  }
  return null;
}

/** Strip any claim secret material from an object before it is persisted or returned. */
export function stripClaimSecrets<T extends Record<string, any>>(value: T): T {
  const clone: Record<string, any> = { ...value };
  delete clone.claimToken;
  delete clone.claimTokenHash;
  return clone as T;
}
