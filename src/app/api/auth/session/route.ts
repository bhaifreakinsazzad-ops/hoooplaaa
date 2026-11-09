import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateCredentials,
  authenticateRequest,
  extractBearerOrCookieToken,
  registerCustomerWithSupabaseAuth,
  SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from '@/domain/auth-guard';
import { persistentDB } from '@/domain/persistent-db';
import { rejectCrossOrigin } from '@/domain/guest-claim';
import {
  RegistrationConfigError,
  enforceRegistrationRateLimit,
  evaluateRegistrationConfig,
  rejectUnlessSameOriginJson,
} from '@/domain/registration-policy';

export async function POST(req: NextRequest) {
  // Login/registration set a session cookie: refuse cross-site requests (CSRF).
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

  // JSON only: blocks plain HTML form posts and keeps malformed bodies from reaching the handlers.
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Unsupported content type.' }, { status: 415 });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const { email, password, action, fullName, businessName } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Self-service customer registration via Supabase Auth (always assigns 'customer' role; ignores any role in body)
    if (action === 'register') {
      // 1. strict same-origin + JSON content type (browsers always send Origin on cross-site POSTs)
      const notSameOrigin = rejectUnlessSameOriginJson(req);
      if (notSameOrigin) return notSameOrigin;

      // 2. fail closed on an unsafe/misconfigured environment (no allowlist, wrong project, ...)
      const cfg = evaluateRegistrationConfig();
      if (!cfg.ok) {
        console.error(`[registration] refused: ${cfg.reason}`);
        return NextResponse.json(
          { error: 'Registration is temporarily unavailable.' },
          { status: 503, headers: { 'Cache-Control': 'no-store, private' } }
        );
      }

      // 3. shared (database-backed) rate limit per client and per email; unavailable limiter => refuse
      const rl = await enforceRegistrationRateLimit(req, String(email));
      if (rl.status === 'limited') {
        return NextResponse.json(
          { error: 'Too many registration attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(rl.retryAfter), 'Cache-Control': 'no-store, private' } }
        );
      }
      if (rl.status === 'unavailable') {
        console.error('[registration] refused: shared rate limiter unavailable (failing closed).');
        return NextResponse.json(
          { error: 'Registration is temporarily unavailable.' },
          { status: 503, headers: { 'Cache-Control': 'no-store, private' } }
        );
      }

      try {
        const { user: created, token, requiresEmailConfirmation } = await registerCustomerWithSupabaseAuth({
          email,
          password,
          fullName: fullName || email,
          businessName: businessName || fullName || email,
        });

        if (requiresEmailConfirmation || !token) {
          // Account exists but may not sign in until the address is confirmed: no token, no cookie.
          return NextResponse.json(
            {
              success: true,
              requiresEmailConfirmation: true,
              message: 'Account created. Confirm your email address before signing in.',
              user: { id: created.id, email: created.email, role: created.role },
            },
            { status: 202, headers: { 'Cache-Control': 'no-store, private' } }
          );
        }

        const response = NextResponse.json({
          success: true,
          token,
          user: {
            id: created.id,
            organizationId: created.organizationId,
            email: created.email,
            fullName: created.fullName,
            role: created.role,
          },
        });
        const isSecureEnv =
          process.env.NODE_ENV === 'production' ||
          process.env.VERCEL_ENV === 'production' ||
          process.env.VERCEL_ENV === 'preview';

        response.cookies.set(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          secure: isSecureEnv,
          sameSite: 'lax',
          path: '/',
          maxAge: 86400,
        });
        return response;
      } catch (regErr: any) {
        if (regErr instanceof RegistrationConfigError) {
          console.error(`[registration] refused: ${regErr.reason}`);
          return NextResponse.json(
            { error: 'Registration is temporarily unavailable.' },
            { status: 503, headers: { 'Cache-Control': 'no-store, private' } }
          );
        }
        const msg = regErr?.message || 'Registration failed.';
        const status = msg.startsWith('Conflict') || msg.includes('already') ? 409 : msg.startsWith('Registration is not open') ? 403 : 400;
        return NextResponse.json({ error: msg }, { status });
      }
    }

    const authResult = await authenticateCredentials(email, password);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const { user, token } = authResult;
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });

    const isSecureEnv =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL_ENV === 'production' ||
      process.env.VERCEL_ENV === 'preview';

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecureEnv,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Authentication error.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ authenticated: false, error: auth.error }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: auth.user.id,
      organizationId: auth.user.organizationId,
      email: auth.user.email,
      fullName: auth.user.fullName,
      role: auth.user.role,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const targetUserId = body.userId || auth.user.id;
    const updated = await persistentDB.updateCustomerProfile(auth.user.id, targetUserId, {
      fullName: body.fullName,
      phoneNumber: body.phoneNumber,
      role: body.role,
      organizationId: body.organizationId,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        organizationId: updated.organizationId,
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
      },
    });
  } catch (error: any) {
    const msg = error?.message || 'Profile update failed.';
    const status = msg.startsWith('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  // 1. CSRF / origin check: this endpoint operates on cookie credentials
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

  // 2. Identify the active authenticated session before revocation
  const auth = await authenticateRequest(req);
  const token = extractBearerOrCookieToken(req);

  if (auth.authenticated) {
    try {
      await persistentDB.recordAuditLog({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: 'AUTH_LOGOUT_SUCCESS',
        entityType: 'user',
        entityId: auth.user.id,
        metadata: { email: auth.user.email },
      });
    } catch {
      // Audit log errors must never block session termination
    }
  }

  // 3. Server-side session revocation: revoke via Supabase Admin API
  if (token) {
    try {
      const admin = persistentDB.getSupabaseAdminClient();
      await admin.auth.admin.signOut(token, 'global');
    } catch (adminErr) {
      console.warn('[auth/logout] admin.signOut warning:', adminErr);
    }

    try {
      const supabaseAuth = persistentDB.getSupabaseAuthClient();
      await supabaseAuth.auth.signOut();
    } catch {
      // Best effort client sign-out
    }
  }

  // 4. Securely clear both session cookies with explicit path, maxAge: 0, and security flags
  const isSecureEnv =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview';

  const response = NextResponse.json(
    { success: true, message: 'Signed out successfully.' },
    { headers: { 'Cache-Control': 'no-store, private' } }
  );

  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set(LEGACY_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
