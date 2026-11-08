'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Order } from '@/domain/types';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';

export default function OrderStatusPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrder() {
      try {
        const res = await fetch(`/api/checkout/initiate?id=${orderId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch order.');
        setOrder(data.order);
      } catch (err: any) {
        setError(err.message || 'Error loading order.');
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-hoooplaaa-gold-500" />
        <p className="text-xs text-slate-500">Retrieving order status...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
          {error || 'Order record not found.'}
        </div>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
        >
          Return to Homepage
        </Link>
      </div>
    );
  }

  const isPaid = order.financialStatus === 'paid';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-8">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-6 text-center">
        <div
          className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
            isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
          }`}
        >
          {isPaid ? <CheckCircle2 className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
            {order.orderNumber}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {isPaid ? 'Payment Confirmed & Order Created!' : 'Payment Under Finance Review'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
            {isPaid
              ? 'Your payment has been reconciled. To start the fulfillment clock, please complete your onboarding intake form.'
              : 'Your payment reference has been recorded. Our finance team will verify the funds against our bank statement.'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-md mx-auto text-left space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Financial Status:</span>
            <span
              className={`font-bold uppercase ${
                isPaid ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {order.financialStatus.replace('_', ' ')}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Workflow Status:</span>
            <span className="font-semibold text-slate-800 capitalize">
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Amount:</span>
            <span className="font-bold text-slate-900">
              ৳{(order.totalMinor / 100).toLocaleString('en-US')} BDT
            </span>
          </div>
        </div>

        {/* SLA Notice */}
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 max-w-md mx-auto text-left flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">SLA Commitment Rule:</strong>
            <span>
              The delivery clock (e.g. 2–4 business days) starts officially once payment is verified
              and your onboarding intake details are submitted.
            </span>
          </div>
        </div>

        <div className="pt-4">
          <Link
            href={`/dashboard/orders/${order.id}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-hoooplaaa-gold-500 to-hoooplaaa-gold-600 hover:from-hoooplaaa-gold-400 hover:to-hoooplaaa-gold-500 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider shadow-gold-glow transition"
          >
            <span>Proceed to Client Workspace & Intake</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
