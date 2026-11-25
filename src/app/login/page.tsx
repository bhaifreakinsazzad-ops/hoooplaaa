'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { BRAND_V3 } from '@/domain/brand-v3';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      if (
        data.user.role === 'admin' ||
        data.user.role === 'finance' ||
        data.user.role === 'engineer'
      ) {
        router.push(searchParams.get('redirect') || '/admin');
      } else {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-brand-ivory py-16 px-4">
      <div className="mx-auto max-w-md border border-brand-hairline bg-white p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center bg-brand-forest text-brand-gold">
            <Lock className="h-5 w-5" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
            {BRAND_V3.legalName}
          </p>
          <h1 className="font-serif text-2xl font-semibold text-brand-forest">
            Sign In to Your Workspace
          </h1>
          <p className="text-xs leading-relaxed text-brand-muted">
            Authenticated session required for order checkout, private onboarding intake, and staff
            operations.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="border border-red-300 bg-red-50 p-3.5 text-xs font-medium text-red-800"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-forest"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-brand-muted" />
              <input
                id="login-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full border border-brand-hairline bg-brand-ivory/40 py-2.5 pl-10 pr-4 text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-forest"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-brand-muted" />
              <input
                id="login-password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full border border-brand-hairline bg-brand-ivory/40 py-2.5 pl-10 pr-4 text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit-btn"
            className="flex w-full items-center justify-center gap-2 bg-brand-forest py-3 px-5 text-xs font-bold uppercase tracking-[0.16em] text-brand-ivory transition-colors hover:bg-brand-teal disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying Session...</span>
              </>
            ) : (
              <>
                <span>Sign In Securely</span>
                <ArrowRight className="h-4 w-4 text-brand-gold" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center gap-2 border-t border-brand-hairline pt-4 text-[11px] text-brand-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-emerald" />
          <span>Server-verified RBAC &amp; multi-tenant Row-Level Security enforced.</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-brand-muted">Loading Sign In...</div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
