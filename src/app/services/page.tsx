'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/providers/AppProviders';
import { CANONICAL_SERVICES, SERVICE_CATEGORIES } from '@/domain/catalog';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Layers,
  Lock,
} from 'lucide-react';

export default function ServicesCatalogPage() {
  const { locale } = useApp();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredServices = CANONICAL_SERVICES.filter((srv) => {
    const matchesCategory =
      activeCategory === 'all' || srv.categoryId === activeCategory;
    const matchesSearch =
      srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.nameBn.includes(searchQuery) ||
      srv.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      {/* Header */}
      <div className="max-w-2xl space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
          {locale === 'en' ? 'Verified Catalog' : 'অনুমোদিত সার্ভিস ক্যাটালগ'}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
          {locale === 'en'
            ? 'Transparent Digital Marketing Infrastructure'
            : 'স্বচ্ছ ডিজিটাল মার্কেটিং অবকাঠামো সার্ভিসসমূহ'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          {locale === 'en'
            ? 'Every service listed below has owner-confirmed working prices, transparent inclusions and exclusions, and strict prerequisite validation.'
            : 'প্রতিটি সার্ভিসের মূল্য, কাজের পরিধি এবং শর্তাবলী স্পষ্টভাবে উল্লেখ করা হয়েছে। কোনো লুকায়িত চার্জ নেই।'}
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeCategory === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Services
          </button>
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by SKU or name..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-hoooplaaa-gold-500 bg-white"
          />
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((srv) => {
          const isCheckoutReady = srv.checkoutEnabled && srv.publicationStatus === 'published';

          return (
            <div
              key={srv.id}
              className={`rounded-2xl border p-6 flex flex-col justify-between transition-all bg-white ${
                srv.sku === 'HI-BUNDLE-3'
                  ? 'border-2 border-hoooplaaa-gold-500 shadow-md ring-1 ring-hoooplaaa-gold-500/20'
                  : 'border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {srv.sku}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{srv.deliveryTarget}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    <Link
                      href={`/services/${srv.slug}`}
                      className="hover:text-hoooplaaa-gold-600 transition"
                    >
                      {locale === 'en' ? srv.name : srv.nameBn}
                    </Link>
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    {locale === 'en' ? srv.shortDescription : srv.shortDescriptionBn}
                  </p>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wider">
                    Core Inclusions:
                  </span>
                  {srv.inclusions.slice(0, 3).map((inc, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{inc}</span>
                    </div>
                  ))}
                </div>

                {srv.exclusions.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                    <strong className="text-slate-700">Excluded:</strong> {srv.exclusions[0]}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 mt-4 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    ৳{(srv.basePriceMinor / 100).toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {srv.billingPeriod === 'weekly'
                      ? 'per week (SaaS)'
                      : srv.billingPeriod === 'monthly'
                      ? 'per month'
                      : 'one-time'}
                  </div>
                </div>

                {isCheckoutReady ? (
                  <Link
                    href={`/build?sku=${srv.sku}`}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition shadow-sm"
                  >
                    <span>Configure</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-semibold text-xs flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Proposed / In Review
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
