'use client';

import React from 'react';
import Link from 'next/link';
import { CANONICAL_SERVICES, SERVICE_CATEGORIES } from '@/domain/catalog';
import { useApp } from '@/components/providers/AppProviders';
import ServiceCard from '@/components/ServiceCard';
import { ArrowRight, Sparkles, Lock } from 'lucide-react';

export function ServicesCatalogClient() {
  const { locale } = useApp();

  const checkoutServices = CANONICAL_SERVICES.filter((s) => s.checkoutEnabled);
  const setupServices = checkoutServices.filter((s) => s.categoryId === 'cat-setup');
  const addonServices = checkoutServices.filter((s) => s.categoryId === 'cat-addon');
  const futureServices = CANONICAL_SERVICES.filter((s) => !s.checkoutEnabled);

  const setupCategory = SERVICE_CATEGORIES.find((c) => c.id === 'cat-setup');
  const addonCategory = SERVICE_CATEGORIES.find((c) => c.id === 'cat-addon');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-14">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{locale === 'en' ? 'Approved Service Registry' : 'অনুমোদিত সার্ভিস রেজিস্ট্রি'}</span>
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
          {locale === 'en' ? 'Our Services' : 'আমাদের সেবাসমূহ'}
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          {locale === 'en'
            ? 'Transparent, fixed-price digital infrastructure setups and conversion add-ons. Every service includes delegated access security and clear scope boundaries.'
            : 'স্বচ্ছ ও নির্ধারিত মূল্যে ডিজিটাল অবকাঠামো সেটআপ ও কনভার্সন অ্যাড-অন। প্রতিটি সেবায় নিরাপদ পার্টনার অ্যাক্সেস ও স্পষ্ট স্কোপ অন্তর্ভুক্ত।'}
        </p>
        <div className="pt-2">
          <Link
            href="/build"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-hoooplaaa-gold-500 hover:bg-hoooplaaa-gold-400 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider shadow-gold-glow transition"
          >
            <span>{locale === 'en' ? 'Launch Package Builder' : 'প্যাকেজ বিল্ডার চালু করুন'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Business Setup & Infrastructure */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {locale === 'en'
              ? setupCategory?.name || 'Business Setup & Infrastructure'
              : setupCategory?.nameBn || 'বিজনেস সেটআপ ও ডিজিটাল অবকাঠামো'}
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {setupServices.length} {locale === 'en' ? 'approved SKUs' : 'টি অনুমোদিত সেবা'}
          </span>
        </div>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {setupServices.map((svc) => (
            <ServiceCard key={svc.id} item={svc} />
          ))}
        </div>
      </section>

      {/* Growth & Tracking Add-ons */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {locale === 'en'
              ? addonCategory?.name || 'Growth & Tracking Add-ons'
              : addonCategory?.nameBn || 'গ্রোথ ও ট্র্যাকিং অ্যাড-অন'}
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {addonServices.length} {locale === 'en' ? 'approved SKUs' : 'টি অনুমোদিত অ্যাড-অন'}
          </span>
        </div>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {addonServices.map((svc) => (
            <ServiceCard key={svc.id} item={svc} />
          ))}
        </div>
      </section>

      {/* Upcoming / Proposed Services */}
      {futureServices.length > 0 && (
        <section className="space-y-4">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              <span>
                {locale === 'en'
                  ? 'Roadmap / Evaluation Required'
                  : 'আসন্ন সেবা (মূল্যায়ন সাপেক্ষে)'}
              </span>
            </h2>
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {futureServices.map((svc) => (
              <div
                key={svc.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-3 opacity-85"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {svc.sku}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    {locale === 'en' ? 'Not Self-Checkout' : 'কোট প্রয়োজন'}
                  </span>
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {locale === 'en' ? svc.name : svc.nameBn}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {locale === 'en' ? svc.shortDescription : svc.shortDescriptionBn}
                </p>
                <Link
                  href={`/services/${svc.slug}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950 pt-1"
                >
                  <span>{locale === 'en' ? 'View specification' : 'বিস্তারিত দেখুন'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
