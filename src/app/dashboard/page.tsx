'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Order } from '@/domain/types';
import { formatBdt } from '@/domain/catalog';
import { ArrowRight, Layers, Plus } from 'lucide-react';

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    <div className="bg-brand-ivory text-brand-ink">
      <section className="border-b border-brand-gold/25 bg-brand-forest py-12 text-brand-platinum">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-4 sm:flex-row sm:items-end sm:px-6 lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
              Client Workspace
            </p>
            <h1 className="mt-1.5 font-serif text-3xl font-semibold text-brand-ivory sm:text-4xl">
              My Business Orders &amp; Deliverables
            </h1>
            <p className="mt-2 text-xs text-brand-platinum/80 sm:text-sm">
              Track onboarding intake, Asia/Dhaka business-day SLA milestones, and QA-approved
              deliverables.
            </p>
          </div>
          <Link
            href="/build"
            className="inline-flex shrink-0 items-center gap-2 bg-brand-gold px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-brand-forest hover:bg-brand-softgold self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>New Package</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="border border-brand-hairline bg-white">
          <div className="flex items-center justify-between border-b border-brand-hairline px-6 py-4">
            <h2 className="font-serif text-lg font-semibold text-brand-forest">
              Active Service Orders
            </h2>
            <span className="text-xs font-medium text-brand-muted">
              {loading ? 'Loading...' : `${orders.length} Total Orders`}
            </span>
          </div>

          {!loading && orders.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center bg-brand-ivory text-brand-emerald">
                <Layers className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-semibold text-brand-forest">
                  No active orders yet
                </h3>
                <p className="mx-auto max-w-md text-xs leading-relaxed text-brand-muted">
                  Configure your package across our 6 departments—starting from ৳990/mo for
                  HOOOPLAAA VA+ or ৳3,000 for Complete 3-Platform Business Setup (PK01).
                </p>
              </div>
              <Link
                href="/build"
                className="inline-flex items-center gap-2 bg-brand-forest px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-brand-ivory hover:bg-brand-teal"
              >
                <span>Open Package Builder</span>
                <ArrowRight className="h-3.5 w-3.5 text-brand-gold" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-brand-hairline">
              {orders.map((ord) => {
                const isPaid = ord.financialStatus === 'paid';
                return (
                  <div
                    key={ord.id}
                    className="flex flex-col justify-between gap-4 p-6 transition-colors hover:bg-brand-ivory/40 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-brand-forest">
                          {ord.orderNumber}
                        </span>
                        <span
                          className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isPaid
                              ? 'border-brand-emerald/40 bg-emerald-50 text-brand-emerald'
                              : 'border-amber-600/40 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {ord.financialStatus.replace('_', ' ')}
                        </span>
                        <span className="capitalize text-brand-muted">
                          · {ord.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="font-serif text-base font-semibold text-brand-forest">
                        {ord.quoteSnapshot.businessName}
                      </div>

                      <div className="text-xs text-brand-muted">
                        {ord.items.map((i) => i.name).join(' · ')}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 sm:justify-end">
                      <div className="text-right">
                        <div className="tabular-price text-base font-bold text-brand-forest">
                          {formatBdt(ord.totalMinor)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-brand-muted">
                          {ord.currency}
                        </div>
                      </div>

                      <Link
                        href={`/dashboard/orders/${ord.id}`}
                        className="inline-flex items-center gap-1.5 bg-brand-forest px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-ivory hover:bg-brand-teal"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="h-3.5 w-3.5 text-brand-gold" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
