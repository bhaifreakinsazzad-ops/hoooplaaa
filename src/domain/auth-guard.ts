import { NextRequest } from 'next/server';
import { persistentDB, DbUserProfile } from './persistent-db';
import { Order } from './types';
import {
  RegistrationConfigError,
  evaluateRegistrationConfig,
  isEmailAllowedForRegistration,
  shouldAutoConfirmRegistrationEmail,
} from './registration-policy';

export { shouldAutoConfirmRegistrationEmail };

export const SESSION_COOKIE_NAME = 'sb-access-token';
export const LEGACY_SESSION_COOKIE_NAME = 'hoooplaaa_session';

/**
 * Authenticates a user strictly via Supabase Auth (`supabase.auth.signInWithPassword`).
 * No custom password hashing, no hardcoded secrets, and no local token signing.
 */
export async function authenticateCredentials(
  email: string,
  password: string
): Promise<{ user: DbUserProfile; token: string } | null> {
  const supabaseAuth = persistentDB.getSupabaseAuthClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data?.user || !data?.session?.access_token) {
    return null;
  }

  let dbUser =
    (await persistentDB.getUserById(data.user.id)) ||
    (await persistentDB.getUserByEmail(normalizedEmail));

  if (!dbUser) {
    // Provision default customer profile if user authenticated in Supabase Auth but profile row is not yet created
    dbUser = await persistentDB.createOrGetCustomerUser({
      id: data.user.id,
      email: normalizedEmail,
      fullName: (data.user.user_metadata?.full_name as string) || normalizedEmail,
      businessName: (data.user.user_metadata?.business_name as string) || normalizedEmail,
    });
  }

  await persistentDB.recordAuditLog({
    actorId: dbUser.id,
    actorRole: dbUser.role,
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'user',
    entityId: dbUser.id,
    metadata: { email: dbUser.email },
  });

  return {
    user: dbUser,
    token: data.session.access_token,
  };
}

/**
 * Validation for self-service registration. Throws a user-facing Error on bad input.
 */
export function validateRegistrationInput(email: string, password: string): string {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Please provide a valid email address.');
  }
  const pw = String(password || '');
  if (pw.length < 10 || pw.length > 128) {
    throw new Error('Password must be between 10 and 128 characters.');
  }
  return normalizedEmail;
}

/**
 * Registers a new customer SERVER-SIDE through the Supabase Auth Admin API (service role), so the project can keep
 * public sign-up (enable_signup) disabled. The role is always forced to 'customer' in public.user_profiles
 * regardless of request payload. If profile provisioning fails, the just-created auth user is removed so no orphan
 * login remains. When email confirmation is required the account exists but no session/token is issued.
 */
export async function registerCustomerWithSupabaseAuth(params: {
  email: string;
  password: string;
  fullName?: string;
  businessName?: string;
}): Promise<{ user: DbUserProfile; token: string; requiresEmailConfirmation: boolean }> {
  // Defence in depth: the route already checked this; fail closed here too for any other caller.
  const config = evaluateRegistrationConfig();
  if (!config.ok) throw new RegistrationConfigError(config.reason);

  const normalizedEmail = validateRegistrationInput(params.email, params.password);
  if (!isEmailAllowedForRegistration(normalizedEmail)) {
    throw new Error('Registration is not open for this email address in this environment.');
  }
  const existing = await persistentDB.getUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('Conflict: An account with this email already exists.');
  }

  const fullName = (params.fullName || normalizedEmail).slice(0, 200);
  const businessName = (params.businessName || params.fullName || normalizedEmail).slice(0, 200);
  const autoConfirm = config.autoConfirm;

  const admin = persistentDB.getSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: params.password,
    email_confirm: autoConfirm,
    user_metadata: { full_name: fullName, business_name: businessName },
  });

  if (error || !data?.user) {
    const msg = error?.message || 'Account creation failed.';
    if (/already|registered|exists/i.test(msg)) {
      throw new Error('Conflict: An account with this email already exists.');
    }
    throw new Error(msg);
  }

  let createdProfile: DbUserProfile;
  try {
    createdProfile = await persistentDB.createOrGetCustomerUser({
      id: data.user.id,
      email: normalizedEmail,
      fullName,
      businessName,
    });
  } catch (provisionErr) {
    try {
      await admin.auth.admin.deleteUser(data.user.id);
    } catch {
      /* best effort: surface the original provisioning error below */
    }
    throw provisionErr;
  }

  if (!autoConfirm) {
    return { user: createdProfile, token: '', requiresEmailConfirmation: true };
  }

  const signInRes = await persistentDB.getSupabaseAuthClient().auth.signInWithPassword({
    email: normalizedEmail,
    password: params.password,
  });
  const accessToken = signInRes.data?.session?.access_token || '';
  if (!accessToken) {
    throw new Error('Account created but automatic sign-in failed. Please sign in manually.');
  }

  return { user: createdProfile, token: accessToken, requiresEmailConfirmation: false };
}

export function extractBearerOrCookieToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const sbCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sbCookie) return sbCookie;

  const legacyCookie = req.cookies.get(LEGACY_SESSION_COOKIE_NAME)?.value;
  if (legacyCookie) return legacyCookie;

  return null;
}

/**
 * Verifies the incoming Supabase Auth JWT via `supabase.auth.getUser(token)`
 * and resolves the authoritative user profile and role directly from PostgreSQL `public.user_profiles`.
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
      error: 'Unauthorized: Missing Supabase authentication token.',
    };
  }

  const supabase = persistentDB.getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Invalid or expired Supabase authentication token.',
    };
  }

  const dbUser =
    (await persistentDB.getUserById(data.user.id)) ||
    (data.user.email ? await persistentDB.getUserByEmail(data.user.email) : null);

  if (!dbUser) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Authenticated user profile does not exist in PostgreSQL.',
    };
  }

  return { authenticated: true, user: dbUser };
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
