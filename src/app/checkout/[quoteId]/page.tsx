'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QuoteSnapshot, PaymentMethod } from '@/domain/types';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Building,
  Smartphone,
  Mail,
  Loader2,
} from 'lucide-react';

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.quoteId as string;

  const [quote, setQuote] = useState<QuoteSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Checkout inputs
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sslcommerz');
  const [processing, setProcessing] = useState<boolean>(false);

  // Manual payment state
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [submittingManual, setSubmittingManual] = useState<boolean>(false);

  useEffect(() => {
    async function loadQuote() {
      try {
        const res = await fetch(`/api/quote?id=${quoteId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load quote.');
        setQuote(data.quote);
      } catch (err: any) {
        setError(err.message || 'Error fetching quote.');
      } finally {
        setLoading(false);
      }
    }
    loadQuote();
  }, [quoteId]);

  const handleInitiateCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim()) {
      alert('Please enter your email address to secure your order.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          customerEmail,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout initiation failed.');

      if (paymentMethod === 'sslcommerz' && data.redirectUrl) {
        router.push(data.redirectUrl);
      } else if (paymentMethod === 'manual_mfs') {
        setCreatedOrderId(data.orderId);
        setShowManualForm(true);
      }
    } catch (err: any) {
      setError(err.message || 'Payment initiation error.');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionRef.trim()) {
      alert('Please enter the transaction reference from your bKash or Nagad SMS.');
      return;
    }

    setSubmittingManual(true);
    try {
      const res = await fetch('/api/checkout/manual-mfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: createdOrderId,
          transactionReference: transactionRef,
          customerPhone,
          provider: 'manual_mfs',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');

      router.push(`/checkout/status/${createdOrderId}`);
    } catch (err: any) {
      setError(err.message || 'Error submitting payment reference.');
    } finally {
      setSubmittingManual(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-hoooplaaa-gold-500" />
        <p className="text-xs text-slate-500">Loading verified quote snapshot...</p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
          {error || 'Quote not found or expired.'}
        </div>
        <button
          onClick={() => router.push('/build')}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
        >
          Return to Configurator
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
          Verified Checkout
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
          Complete Your Order
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review quote snapshot, authenticate ownership, and choose an approved payment channel.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left: Authentication & Payment Method Form */}
        <div className="md:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
          {!showManualForm ? (
            <form onSubmit={handleInitiateCheckout} className="space-y-6">
              {/* Account Association */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-hoooplaaa-gold-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Step 1: Your Account / Contact Email
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500">
                  Your order receipt, dashboard magic link, and deliverable access will be sent here.
                </p>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                  required
                />
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-hoooplaaa-gold-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Step 2: Choose Payment Method
                  </h3>
                </div>

                <div className="space-y-3">
                  {/* SSLCOMMERZ */}
                  <label
                    onClick={() => setPaymentMethod('sslcommerz')}
                    className={`p-4 rounded-xl border cursor-pointer block transition ${
                      paymentMethod === 'sslcommerz'
                        ? 'border-hoooplaaa-gold-500 bg-amber-50/40 ring-1 ring-hoooplaaa-gold-500'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                          <span>SSLCOMMERZ Gateway (Sandbox Simulator)</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">
                            Instant Verification
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Visa, Mastercard, bKash, Nagad, Rocket, or Internet Banking.
                        </p>
                      </div>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'sslcommerz'}
                        onChange={() => setPaymentMethod('sslcommerz')}
                        className="mt-1 text-hoooplaaa-gold-500"
                      />
                    </div>
                  </label>

                  {/* Manual MFS */}
                  <label
                    onClick={() => setPaymentMethod('manual_mfs')}
                    className={`p-4 rounded-xl border cursor-pointer block transition ${
                      paymentMethod === 'manual_mfs'
                        ? 'border-hoooplaaa-gold-500 bg-amber-50/40 ring-1 ring-hoooplaaa-gold-500'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                          <span>Manual MFS / Bank Transfer Reference</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            Finance Review
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Send BDT to our official account and provide the TrxID. Verified by finance.
                        </p>
                      </div>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'manual_mfs'}
                        onChange={() => setPaymentMethod('manual_mfs')}
                        className="mt-1 text-hoooplaaa-gold-500"
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-hoooplaaa-gold-500 to-hoooplaaa-gold-600 hover:from-hoooplaaa-gold-400 hover:to-hoooplaaa-gold-500 disabled:opacity-50 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider shadow-gold-glow flex items-center justify-center gap-2 transition"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>
                        Proceed to {paymentMethod === 'sslcommerz' ? 'Gateway' : 'Reference Submission'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Manual MFS Reference Submission Form */
            <form onSubmit={handleManualSubmission} className="space-y-5">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                <strong className="font-semibold block">Official Payment Instructions:</strong>
                <p>
                  Please send <strong>৳{(quote.totalMinor / 100).toLocaleString('en-US')}</strong> to:
                </p>
                <div className="font-mono text-slate-800 bg-white p-2 rounded border border-blue-200 mt-1 space-y-0.5">
                  <div>bKash Merchant: 018XXXXXXXX (Simulation)</div>
                  <div>Nagad Merchant: 017XXXXXXXX (Simulation)</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    bKash / Nagad Transaction ID (TrxID) *
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. 9K72BXYZ01"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900 uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sender Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                  />
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                  <strong className="font-semibold block">Important Policy:</strong>
                  Your order status will enter <em>&apos;Payment Under Review&apos;</em>. Setup work and SLA
                  timer begins only after our finance team verifies the funds against our bank statement.
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingManual}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
              >
                {submittingManual ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Submit Payment Reference</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right: Order Summary Sidebar */}
        <div className="md:col-span-5 bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
              Order Summary
            </span>
            <span className="text-[11px] font-mono text-slate-500">Ref: {quote.id.slice(0, 12)}</span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            {quote.items.map((item, i) => (
              <div key={i} className="pt-2 flex justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{item.name}</div>
                  <div className="text-[11px] text-slate-500">SKU: {item.sku}</div>
                </div>
                <div className="font-mono text-slate-800 font-bold">
                  ৳{(item.lineTotalMinor / 100).toLocaleString('en-US')}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span>৳{(quote.subtotalMinor / 100).toLocaleString('en-US')}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
              <span>Total Due:</span>
              <span>৳{(quote.totalMinor / 100).toLocaleString('en-US')}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Immutable Price Protection</span>
            </div>
            <p>
              This total is fixed and recorded server-side with terms hash {quote.termsHash.slice(0, 8)}.
              Subsequent price changes will never alter this order.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
