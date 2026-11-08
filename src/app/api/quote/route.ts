import { NextRequest, NextResponse } from 'next/server';
import { calculateServerQuote } from '@/domain/pricing-engine';
import { persistentDB } from '@/domain/persistent-db';
import { authenticateRequest } from '@/domain/auth-guard';
import {
  GUEST_CLAIM_TTL_SECONDS,
  generateGuestClaim,
  readGuestClaimToken,
  rejectCrossOrigin,
  setGuestClaimCookie,
  stripClaimSecrets,
} from '@/domain/guest-claim';

const NO_STORE = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

  try {
    const body = await req.json();
    const {
      businessId = 'biz_guest',
      businessName,
      businessProfile = {},
      selectedPlatformSkus = [],
      selectedAddonSkus = [],
    } = body;

    if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
      return json({ error: 'Business Name is required to generate an authoritative quote.' }, 400);
    }

    const auth = await authenticateRequest(req);

    // Server-authoritative pricing & eligibility calculation (ignores any client price inputs)
    const quote = calculateServerQuote({
      businessId: auth.authenticated ? auth.user.organizationId : businessId,
      businessName: businessName.trim(),
      businessProfile,
      selectedPlatformSkus,
      selectedAddonSkus,
    });

    const customerId = auth.authenticated ? auth.user.id : undefined;
    const organizationId = auth.authenticated ? auth.user.organizationId : undefined;

    // Guests receive an opaque, server-managed, short-lived, single-use capability delivered ONLY as an
    // HttpOnly cookie. Only its SHA-256 hash is stored (service_role-only table); it is never returned in
    // JSON, never placed in a URL and never written to client-readable storage.
    const guestClaim = !auth.authenticated ? generateGuestClaim() : undefined;

    const enrichedQuote = stripClaimSecrets({ ...quote, customerId, organizationId } as Record<string, any>);

    await persistentDB.saveQuote(
      enrichedQuote as any,
      customerId,
      organizationId,
      guestClaim
        ? {
            tokenHash: guestClaim.tokenHash,
            expiresAt: new Date(Date.now() + GUEST_CLAIM_TTL_SECONDS * 1000).toISOString(),
          }
        : undefined
    );

    const res = json({ success: true, quote: enrichedQuote });
    if (guestClaim) {
      setGuestClaimCookie(res, req, quote.id, guestClaim.token);
    }
    return res;
  } catch (error: any) {
    return json({ error: error?.message || 'Error calculating server quote.' }, 400);
  }
}

export async function GET(req: NextRequest) {
  const quoteId = req.nextUrl.searchParams.get('id');
  if (!quoteId) {
    return json({ error: 'Quote ID is required.' }, 400);
  }

  const stored = await persistentDB.getQuote(quoteId);
  if (!stored) {
    return json({ error: 'Quote not found.' }, 404);
  }
  const quote = stripClaimSecrets(stored as unknown as Record<string, any>) as any;

  // 1. Expiration Verification
  if (new Date(quote.expiresAt) < new Date()) {
    return json({ error: 'Quote snapshot has expired. Please configure a new quote.' }, 410);
  }

  // 2. Ownership & Privacy Check
  const attachedCustomerId = quote.customerId;
  const attachedOrgId = quote.organizationId;

  if (attachedCustomerId || attachedOrgId) {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return json({ error: 'Unauthorized: This quote is attached to an account. Please sign in to view it.' }, 401);
    }

    const isStaff = ['admin', 'finance', 'engineer'].includes(auth.user.role);
    const isOwner =
      auth.user.id === attachedCustomerId ||
      (Boolean(attachedOrgId) && auth.user.organizationId === attachedOrgId);

    if (!isStaff && !isOwner) {
      await persistentDB.recordAuditLog({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: 'CROSS_TENANT_QUOTE_ACCESS_DENIED',
        entityType: 'quote',
        entityId: quoteId,
        metadata: {
          attemptedByOrg: auth.user.organizationId,
          quoteOwnerId: attachedCustomerId,
        },
      });
      return json({ error: 'Forbidden: You do not have permission to access this quote.' }, 403);
    }
    return json({ success: true, quote });
  }

  // 3. Unclaimed guest quote: the quote id alone NEVER authorises reading it. Requires the HttpOnly
  //    capability cookie issued to the browser that created it (or an authenticated staff member).
  //    Anything else is indistinguishable from "not found" (no enumeration signal).
  const claimToken = readGuestClaimToken(req, quote.id);
  const hasCapability = await persistentDB.verifyGuestQuoteClaim(quote.id, claimToken);
  if (!hasCapability) {
    const auth = await authenticateRequest(req);
    const isStaff = auth.authenticated && ['admin', 'finance', 'engineer'].includes(auth.user.role);
    if (!isStaff) {
      return json({ error: 'Quote not found.' }, 404);
    }
  }

  return json({ success: true, quote });
}
