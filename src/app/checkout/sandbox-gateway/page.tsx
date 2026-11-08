'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Lock,
} from 'lucide-react';

function GatewaySimulator() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const attemptId = searchParams.get('attemptId') || 'pay_test_default';
  const amount = searchParams.get('amount') || '3000';

  const [loading, setLoading] = useState(false);
  const [resultLog, setResultLog] = useState<string | null>(null);

  // Security gate: Ensure development simulator is never accessible in production
  const isProduction =
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_PAYMENT_MODE === 'production';

  if (isProduction) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-red-500/30 rounded-2xl p-8 text-center text-white">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-serif mb-2">Access Prohibited</h2>
          <p className="text-slate-400 text-sm mb-6">
            The local payment simulator is strictly disabled in production. Transactions must be
            processed via authorized payment gateway endpoints.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  const simulateCallback = async (scenario: 'success' | 'failure' | 'tampered') => {
    setLoading(true);
    setResultLog(null);

    let payload: Record<string, string>;

    if (scenario === 'success') {
      payload = {
        tran_id: attemptId,
        val_id: `SSL-VAL-${Date.now()}`,
        status: 'VALID',
        amount: parseFloat(amount).toFixed(2),
        currency: 'BDT',
      };
    } else if (scenario === 'failure') {
      payload = {
        tran_id: attemptId,
        val_id: `SSL-VAL-FAIL-${Date.now()}`,
        status: 'FAILED',
        amount: parseFloat(amount).toFixed(2),
        currency: 'BDT',
      };
    } else {
      // Tampered amount attack (e.g., attacker tries to submit 1 Taka)
      payload = {
        tran_id: attemptId,
        val_id: `SSL-VAL-HACK-${Date.now()}`,
        status: 'VALID',
        amount: '1.00',
        currency: 'BDT',
      };
    }

    try {
      const res = await fetch('/api/checkout/callback/sslcommerz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResultLog(`Success: Verified paid. Redirecting to order status...`);
        setTimeout(() => {
          router.push(`/checkout/status/${data.orderId}`);
        }, 1200);
      } else {
        setResultLog(`Rejected: ${data.error || 'Payment validation failed'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown network error';
      setResultLog(`Network error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="bg-[#071525] p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-lg font-serif">SSLCOMMERZ Gateway Sandbox</h1>
                <p className="text-xs text-slate-400">Merchant Acceptance Testing Environment</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-amber-400/10 text-amber-400 border border-amber-400/20 text-xs font-semibold rounded-full">
              Sandbox Active
            </span>
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="p-6 space-y-6">
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/60 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Attempt ID:</span>
              <span className="font-mono text-xs text-amber-300">{attemptId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Merchant Store:</span>
              <span className="text-white font-medium">HOOOPLAAA INCORPORATED</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-slate-700/60 pt-2">
              <span className="text-slate-300">Authorized Total:</span>
              <span className="text-amber-400 font-mono">৳{parseFloat(amount).toLocaleString()} BDT</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Select a simulation scenario to test real server-side IPN verification, amount mismatch rejection, and idempotency guarantees:
          </p>

          <div className="space-y-3">
            <button
              onClick={() => simulateCallback('success')}
              disabled={loading}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl transition-colors font-medium text-sm group"
            >
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div className="text-left">
                  <div>Simulate Successful Payment</div>
                  <div className="text-xs text-emerald-400/70 font-normal">Valid status, matching ৳{amount}</div>
                </div>
              </div>
              <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded font-mono">200 OK</span>
            </button>

            <button
              onClick={() => simulateCallback('failure')}
              disabled={loading}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-red-600/10 hover:bg-red-600/20 text-red-300 border border-red-500/30 rounded-xl transition-colors font-medium text-sm"
            >
              <div className="flex items-center space-x-3">
                <XCircle className="w-5 h-5 text-red-400" />
                <div className="text-left">
                  <div>Simulate Bank Decline / Failure</div>
                  <div className="text-xs text-red-400/70 font-normal">Status: FAILED, order remains unpaid</div>
                </div>
              </div>
              <span className="text-xs bg-red-500/20 px-2 py-0.5 rounded font-mono">DECLINE</span>
            </button>

            <button
              onClick={() => simulateCallback('tampered')}
              disabled={loading}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-xl transition-colors font-medium text-sm"
            >
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <div className="text-left">
                  <div>Simulate Tampered Amount Attack</div>
                  <div className="text-xs text-amber-400/70 font-normal">Status: VALID, but amount: ৳1.00</div>
                </div>
              </div>
              <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded font-mono">RISK_HOLD</span>
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center space-x-2 text-sm text-slate-300 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Transmitting server-to-server callback...</span>
            </div>
          )}

          {resultLog && (
            <div className="p-3 bg-slate-950/80 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 break-all">
              {resultLog}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-900/50 p-4 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Strict SHA-256 HMAC and Val_ID Replay Guard</span>
          </div>
          <button
            onClick={() => router.back()}
            className="hover:text-white transition-colors flex items-center space-x-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SandboxGatewayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
          Loading payment gateway session...
        </div>
      }
    >
      <GatewaySimulator />
    </Suspense>
  );
}
