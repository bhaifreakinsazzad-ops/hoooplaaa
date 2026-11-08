import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateCredentials,
  authenticateRequest,
  registerCustomerWithSupabaseAuth,
  SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from '@/domain/auth-guard';
import { persistentDB } from '@/domain/persistent-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, action, fullName, businessName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Self-service customer registration via Supabase Auth (always assigns 'customer' role; ignores any role in body)
    if (action === 'register') {
      try {
        const { user: created, token } = await registerCustomerWithSupabaseAuth({
          email,
          password,
          fullName: fullName || email,
          businessName: businessName || fullName || email,
        });

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
        response.cookies.set(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 86400,
        });
        return response;
      } catch (regErr: any) {
        const msg = regErr?.message || 'Registration failed.';
        const status = msg.startsWith('Conflict') || msg.includes('already') ? 409 : 400;
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
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
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

export async function DELETE() {
  try {
    const supabaseAuth = persistentDB.getSupabaseAuthClient();
    await supabaseAuth.auth.signOut();
  } catch {
    // Ignore sign-out errors when clearing cookies
  }
  const response = NextResponse.json({ success: true, message: 'Signed out.' });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(LEGACY_SESSION_COOKIE_NAME);
  return response;
}
