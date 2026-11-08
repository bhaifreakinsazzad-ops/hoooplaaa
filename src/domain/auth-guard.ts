import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { persistentDB, DbUserProfile, hashPassword } from './persistent-db';
import { Order } from './types';

const SESSION_SECRET =
  process.env.INTERNAL_AUDIT_SALT || 'hoooplaaa-v5-authoritative-session-hmac-secret-2026';

export const SESSION_COOKIE_NAME = 'hoooplaaa_session';

export interface SessionTokenPayload {
  sub: string; // UUID of user_profiles.id
  email: string;
  iat: number;
  exp: number;
}

export function issueSessionToken(user: DbUserProfile, ttlSeconds = 86400): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionTokenSignature(token: string): SessionTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encodedPayload)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionTokenPayload;

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.sub || !payload.exp || payload.exp < nowSec) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function authenticateCredentials(
  email: string,
  password: string
): Promise<{ user: DbUserProfile; token: string } | null> {
  const user = await persistentDB.getUserByEmail(email);
  if (!user) return null;

  const expectedHash = hashPassword(password);
  if (user.passwordHash !== expectedHash) {
    return null;
  }

  const token = issueSessionToken(user);
  await persistentDB.recordAuditLog({
    actorId: user.id,
    actorRole: user.role,
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'user',
    entityId: user.id,
    metadata: { email: user.email },
  });

  return { user, token };
}

export function extractBearerOrCookieToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) return sessionCookie;

  const sbCookie = req.cookies.get('sb-access-token')?.value;
  if (sbCookie) return sbCookie;

  return null;
}

/**
 * Verifies the incoming session token or Supabase JWT and resolves the authoritative
 * user profile and role directly from the database (never trusting client claims for role/org).
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<
  | { authenticated: true; user: DbUserProfile }
  | { authenticated: false; status: 401; error: string }
> {
  const token = extractBearerOrCookieToken(req);
  if (!token) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Missing authentication session token.',
    };
  }

  // 1. Verify HMAC-signed server session token
  const verifiedPayload = verifySessionTokenSignature(token);
  if (verifiedPayload) {
    const dbUser = await persistentDB.getUserById(verifiedPayload.sub);
    if (!dbUser) {
      return {
        authenticated: false,
        status: 401,
        error: 'Unauthorized: Session user profile no longer exists.',
      };
    }
    return { authenticated: true, user: dbUser };
  }

  // 2. Verify live Supabase Auth JWT if Supabase client is connected
  const supabase = persistentDB.getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      const dbUser =
        (await persistentDB.getUserById(data.user.id)) ||
        (data.user.email ? await persistentDB.getUserByEmail(data.user.email) : null);
      if (dbUser) {
        return { authenticated: true, user: dbUser };
      }
    }
  }

  return {
    authenticated: false,
    status: 401,
    error: 'Unauthorized: Invalid or expired authentication token.',
  };
}

export async function requireRole(
  req: NextRequest,
  allowedRoles: Array<DbUserProfile['role']>
): Promise<
  | { authorized: true; user: DbUserProfile }
  | { authorized: false; status: 401 | 403; error: string }
> {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return { authorized: false, status: 401, error: auth.error };
  }

  if (!allowedRoles.includes(auth.user.role)) {
    await persistentDB.recordAuditLog({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: 'RBAC_ACCESS_DENIED',
      entityType: 'security',
      entityId: req.nextUrl.pathname,
      metadata: {
        requiredRoles: allowedRoles,
        actualRole: auth.user.role,
      },
    });
    return {
      authorized: false,
      status: 403,
      error: `Forbidden: Role '${auth.user.role}' is not authorized for this operation.`,
    };
  }

  return { authorized: true, user: auth.user };
}

export async function requireOrderAccess(
  req: NextRequest,
  order: Order & { organizationId?: string }
): Promise<
  | { authorized: true; user: DbUserProfile }
  | { authorized: false; status: 401 | 403; error: string }
> {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return { authorized: false, status: 401, error: auth.error };
  }

  const { user } = auth;

  // Staff roles (admin, finance, engineer) can access orders for operational lifecycle management
  if (user.role === 'admin' || user.role === 'finance' || user.role === 'engineer') {
    return { authorized: true, user };
  }

  // Customer tenant isolation: must match customerUserId or organizationId
  const isOwner =
    order.customerUserId === user.id ||
    (Boolean(order.organizationId) && order.organizationId === user.organizationId);

  if (!isOwner) {
    await persistentDB.recordAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'CROSS_TENANT_ACCESS_DENIED',
      entityType: 'order',
      entityId: order.id,
      metadata: {
        attemptedByOrg: user.organizationId,
        resourceOwnerId: order.customerUserId,
      },
    });
    return {
      authorized: false,
      status: 403,
      error: 'Forbidden: Cross-customer resource access is strictly prohibited.',
    };
  }

  return { authorized: true, user };
}
