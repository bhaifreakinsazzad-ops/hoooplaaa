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
} from 'lucide-react';

function GatewaySimulator() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const attemptId = searchParams.get('attemptId') || 'pay_test_default';
  const amount = searchParams.get('amount') || '3000';

  const [loading, setLoading] = useState(false);
  const [resultLog, setResultLog] = useState<string | null>(null);

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
      // Tampered amount attack (e.g., hacker tries to submit 1 Taka)
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
        setResultLog('Payment verified by server. Redirecting to Order Confirmation...');
        setTimeout(() => {
          router.push(`/checkout/status/${data.orderId}`);
        }, 1200);
      } else {
        setResultLog(
          `Verification response: ${data.error || 'Failed'} (Status: ${data.status || 'rejected'})`
        );
      }
    } catch (err: any) {
      setResultLog(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-16 space-y-6">
      <div className="bg-white rounded-3xl border-2 border-slate-300 p-8 shadow-xl space-y-6">
        {/* Gateway Simulation Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-sm">
              SSL
            </div>
            <div>
              <span className="font-bold text-sm text-slate-900 block">
                SSLCOMMERZ Hosted Simulator
              </span>
              <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-1.5 py-0.5 rounded">
                SANDBOX / TEST MODE
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Payable Total</span>
            <span className="text-xl font-black text-slate-900">৳{amount} BDT</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
          <div className="font-semibold text-slate-800">Test Harness Verification:</div>
          <p>
            This sandbox environment emulates the server-to-server IPN callback flow without
            charging real currency. Choose a scenario below to test deterministic server
            reconciliation.
          </p>
        </div>

        {resultLog && (
          <div className="p-3.5 rounded-xl bg-slate-900 text-white text-xs font-mono">
            {resultLog}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => simulateCallback('success')}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-md"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulate Successful Payment (VALID)</span>
              </>
            )}
          </button>

          <button
            onClick={() => simulateCallback('tampered')}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Test Security: Tampered Amount (৳1.00)</span>
          </button>

          <button
            onClick={() => simulateCallback('failure')}
            disabled={loading}
            className="w-full py-3 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
          >
            <XCircle className="w-4 h-4" />
            <span>Simulate Gateway Failure (FAILED)</span>
          </button>
        </div>

        <div className="pt-2 text-center">
          <button
            onClick={() => router.back()}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Cancel and Return
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GatewayPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs">Loading simulator...</div>}>
      <GatewaySimulator />
    </Suspense>
  );
}
