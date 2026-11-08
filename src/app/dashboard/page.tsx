'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Order } from '@/domain/types';
import {
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In our prototype, fetch active orders from API or global store
    async function fetchOrders() {
      try {
        const res = await fetch('/api/admin/orders');
        const data = await res.json();
        if (data.orders) {
          setOrders(data.orders);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
            Client Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            My Business Orders & Setups
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track onboarding progress, submit requirements, and manage delivered agency assets.
          </p>
        </div>

        <Link
          href="/build"
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 self-start sm:self-auto transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Setup Package</span>
        </Link>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-900">Active Service Orders</h2>
          <span className="text-xs text-slate-500">{orders.length} Total Orders</span>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-800">No active orders yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Configure your digital infrastructure with Meta, Google, and LinkedIn to launch your
                omni-channel presence.
              </p>
            </div>
            <Link
              href="/build"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-hoooplaaa-gold-500 hover:bg-hoooplaaa-gold-400 text-hoooplaaa-navy-950 text-xs font-bold uppercase tracking-wider"
            >
              <span>Build My Package (from ৳1,500)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((ord) => {
              const isPaid = ord.financialStatus === 'paid';
              return (
                <div
                  key={ord.id}
                  className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {ord.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ord.financialStatus.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-500 capitalize">
                        • {ord.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-slate-800">
                      {ord.quoteSnapshot.businessName}
                    </div>

                    <div className="text-xs text-slate-500">
                      {ord.items.map((i) => i.name).join(' • ')}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">
                        ৳{(ord.totalMinor / 100).toLocaleString('en-US')}
                      </div>
                      <div className="text-[11px] text-slate-500">{ord.currency}</div>
                    </div>

                    <Link
                      href={`/dashboard/orders/${ord.id}`}
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition flex items-center gap-1"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
