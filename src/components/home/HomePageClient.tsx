'use client';

import React from 'react';
import Link from 'next/link';
import { CANONICAL_SERVICES } from '@/domain/catalog';
import { useApp } from '@/components/providers/AppProviders';
import ServiceCard from '@/components/ServiceCard';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Layers,
  FileSearch,
  Lock,
} from 'lucide-react';

export function HomePageClient() {
  const { locale } = useApp();

  const bundle = CANONICAL_SERVICES.find((s) => s.sku === 'HI-BUNDLE-3');
  const corePlatforms = CANONICAL_SERVICES.filter(
    (s) => s.checkoutEnabled && s.categoryId === 'cat-setup' && s.sku !== 'HI-BUNDLE-3'
  );
  const addOns = CANONICAL_SERVICES.filter(
    (s) => s.checkoutEnabled && s.categoryId === 'cat-addon'
  );

  return (
    <div className="flex flex-col">
      {/* Executive Hero Section */}
      <section className="bg-hoooplaaa-navy-950 text-white border-b border-hoooplaaa-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Copy */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-hoooplaaa-navy-900 border border-hoooplaaa-gold-500/40 text-hoooplaaa-gold-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-hoooplaaa-gold-400" />
              <span>
                {locale === 'en'
                  ? 'Bangladesh Digital Infrastructure Commerce'
                  : 'বাংলাদেশ ডিজিটাল অবকাঠামো কমার্স'}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
              {locale === 'en' ? (
                <>
                  Build your business foundation.{' '}
                  <span className="text-hoooplaaa-gold-400">Choose what you need.</span> Order
                  online.
                </>
              ) : (
                <>
                  আপনার ব্যবসার ডিজিটাল ভিত্তি তৈরি করুন।{' '}
                  <span className="text-hoooplaaa-gold-400">প্রয়োজনীয় সেবা বেছে নিন।</span>{' '}
                  অনলাইনে অর্ডার করুন।
                </>
              )}
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              {locale === 'en'
                ? 'Attract. Connect. Convert. Grow. Professional Meta, Google, and LinkedIn setups with server-authoritative pricing, transparent eligibility checks, and zero human sales friction.'
                : 'অ্যাট্রাক্ট। কানেক্ট। কনভার্ট। গ্রো। সার্ভার-নিয়ন্ত্রিত স্বচ্ছ মূল্য, যোগ্যতা যাচাই এবং ঝামেলামুক্ত অনলাইন অর্ডারে মেটা, গুগল ও লিঙ্কডইন সেটআপ।'}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/build"
                className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-hoooplaaa-gold-500 to-hoooplaaa-gold-600 hover:from-hoooplaaa-gold-400 hover:to-hoooplaaa-gold-500 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider shadow-gold-glow transition inline-flex items-center gap-2"
              >
                <span>{locale === 'en' ? 'Build My Package' : 'প্যাকেজ তৈরি করুন'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/services"
                className="px-6 py-3.5 rounded-xl bg-hoooplaaa-navy-900 hover:bg-hoooplaaa-navy-800 border border-hoooplaaa-navy-700 text-white font-semibold text-xs transition inline-flex items-center gap-2"
              >
                <span>{locale === 'en' ? 'Explore Approved Services' : 'অনুমোদিত সেবাসমূহ দেখুন'}</span>
              </Link>
            </div>

            <div className="pt-6 border-t border-hoooplaaa-navy-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{locale === 'en' ? 'Zero Password Exchange' : 'পাসওয়ার্ডবিহীন সেটআপ'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{locale === 'en' ? 'Fixed BDT Snapshots' : 'নির্দিষ্ট বিডিটি মূল্য'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{locale === 'en' ? 'Contractual SLA Clock' : 'চুক্তিভিত্তিক এসএলএ'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{locale === 'en' ? 'Dual Free Audit' : 'ফ্রি বিজনেস অডিট'}</span>
              </div>
            </div>
          </div>

          {/* Right Hero Bundle Offer Card */}
          {bundle && (
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl bg-hoooplaaa-navy-900/95 border border-hoooplaaa-gold-500/40 p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full bg-hoooplaaa-gold-500 text-hoooplaaa-navy-950 text-[11px] font-black uppercase tracking-wider shadow">
                  {locale === 'en' ? 'Hero Bundle Offer' : 'হিরো বান্ডেল অফার'}
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-hoooplaaa-gold-400">
                    {locale === 'en' ? 'Core Foundation Setup' : 'কোর ফাউন্ডেশন সেটআপ'}
                  </span>
                  <h2 className="text-2xl font-extrabold text-white">
                    {locale === 'en' ? bundle.name : bundle.nameBn}
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {locale === 'en' ? bundle.shortDescription : bundle.shortDescriptionBn}
                  </p>
                </div>

                <div className="rounded-2xl bg-hoooplaaa-navy-950/90 border border-hoooplaaa-navy-700/70 p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-white">৳3,000</span>
                      <span className="text-xs text-slate-400">
                        {locale === 'en' ? 'one-time' : 'এককালীন'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3.5 h-3.5 text-hoooplaaa-gold-400" />
                      <span>{bundle.deliveryTarget}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 line-through">৳4,500</div>
                    <div className="text-xs font-bold text-emerald-400">
                      {locale === 'en' ? 'Save ৳1,500 (33⅓%)' : '৳১,৫০০ সাশ্রয় (৩৩⅓%)'}
                    </div>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-200">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-hoooplaaa-gold-400 shrink-0" />
                    <span>
                      {locale === 'en'
                        ? 'Meta Business Portfolio + Facebook Page + IG'
                        : 'মেটা বিজনেস পোর্টফোলিও + ফেসবুক পেজ + ইনস্টাগ্রাম'}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-hoooplaaa-gold-400 shrink-0" />
                    <span>
                      {locale === 'en'
                        ? 'Google Business Profile (Storefront/Service Area)'
                        : 'গুগল বিজনেস প্রোফাইল (স্টোরফ্রন্ট/সার্ভিস এরিয়া)'}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-hoooplaaa-gold-400 shrink-0" />
                    <span>
                      {locale === 'en'
                        ? 'LinkedIn Corporate Company Page'
                        : 'লিঙ্কডইন কর্পোরেট কোম্পানি পেজ'}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-hoooplaaa-gold-400 shrink-0" />
                    <span>
                      {locale === 'en'
                        ? 'Complimentary Post-Sale Detailed Audit'
                        : 'ফ্রি পোস্ট-সেল ডিটেইল্ড অডিট অন্তর্ভুক্ত'}
                    </span>
                  </li>
                </ul>

                <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block text-amber-300">
                      {locale === 'en' ? 'Google Policy Requirement:' : 'গুগল পলিসি শর্ত:'}
                    </strong>
                    <span>
                      {locale === 'en'
                        ? 'Physical storefront or in-person service area required. Pure online companies are guided to custom scopes.'
                        : 'ফিজিক্যাল শপ বা লোকাল সার্ভিস এরিয়া প্রয়োজন। শুধু অনলাইন ব্যবসার জন্য কাস্টম স্কোপ রয়েছে।'}
                    </span>
                  </div>
                </div>

                <Link
                  href="/build?preset=bundle"
                  className="w-full py-3.5 px-5 rounded-xl bg-hoooplaaa-gold-500 hover:bg-hoooplaaa-gold-400 text-hoooplaaa-navy-950 font-extrabold text-xs uppercase tracking-wider text-center block shadow-gold-glow transition"
                >
                  {locale === 'en'
                    ? 'Configure 3-Platform Bundle (৳3,000)'
                    : '৩-প্ল্যাটফর্ম বান্ডেল কনফিগার করুন (৳৩,০০০)'}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Individual Platform Setups */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-16 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
              {locale === 'en' ? 'Approved Fixed-Price Setups' : 'অনুমোদিত ফিক্সড-প্রাইস সেটআপ'}
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900">
              {locale === 'en'
                ? 'Individual Platform Infrastructure'
                : 'পৃথক প্ল্যাটফর্ম অবকাঠামো সেটআপ'}
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              {locale === 'en'
                ? 'Order only the exact channels you need with clear inclusions, exclusions, and predictable SLA delivery targets.'
                : 'স্পষ্ট ইনক্লুশন, এক্সক্লুশন এবং নির্ধারিত ডেলিভারি এসএলএ সহ আপনার প্রয়োজনীয় প্ল্যাটফর্মটি নির্বাচন করুন।'}
            </p>
          </div>
          <Link
            href="/services"
            className="text-xs font-bold text-hoooplaaa-navy-900 hover:text-hoooplaaa-gold-600 inline-flex items-center gap-1 transition"
          >
            <span>{locale === 'en' ? 'View full catalog' : 'সম্পূর্ণ ক্যাটালগ দেখুন'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {corePlatforms.map((svc) => (
            <ServiceCard key={svc.id} item={svc} />
          ))}
        </div>
      </section>

      {/* Growth & Tracking Add-ons */}
      <section className="bg-slate-100/80 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-10">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
              {locale === 'en' ? 'Conversion & Attribution Upgrades' : 'কনভার্সন ও ট্র্যাকিং অ্যাড-অন'}
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900">
              {locale === 'en' ? 'Growth & Tracking Add-ons' : 'গ্রোথ ও ট্র্যাকিং অ্যাড-অনসমূহ'}
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              {locale === 'en'
                ? 'Combine automated customer messaging, pixel tracking, and scroll-stopping ad creatives directly inside the package builder.'
                : 'প্যাকেজ বিল্ডার থেকে সরাসরি হোয়াটসঅ্যাপ অটোমেশন, পিক্সেল ট্র্যাকিং ও অ্যাড ক্রিয়েটিভ যুক্ত করুন।'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {addOns.map((svc) => (
              <ServiceCard key={svc.id} item={svc} />
            ))}
          </div>
        </div>
      </section>

      {/* Complimentary Pre-Sale Audit CTA */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="rounded-3xl bg-hoooplaaa-navy-950 text-white p-8 sm:p-12 border border-hoooplaaa-navy-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-hoooplaaa-gold-400 uppercase tracking-wider">
              <FileSearch className="w-4 h-4" />
              <span>{locale === 'en' ? 'Not Sure Where To Start?' : 'কোথা থেকে শুরু করবেন বুঝতে পারছেন না?'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {locale === 'en'
                ? 'Request a Free Public Readiness Audit'
                : 'ফ্রি পাবলিক রেডিনেস অডিটের অনুরোধ করুন'}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {locale === 'en'
                ? 'We inspect your public Facebook Page, Google presence, and website to highlight missing foundations—with zero passwords or access required.'
                : 'কোনো পাসওয়ার্ড ছাড়াই আমরা আপনার পাবলিক ফেসবুক পেজ, গুগল ও ওয়েবসাইট বিশ্লেষণ করে ঘাটতিগুলো জানিয়ে দেব।'}
            </p>
            <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {locale === 'en' ? 'Public-only inspection' : 'শুধুমাত্র পাবলিক বিশ্লেষণ'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-hoooplaaa-gold-400" />
                {locale === 'en' ? '100% client asset ownership' : '১০০% গ্রাহক মালিকানা'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                {locale === 'en' ? 'Actionable 24–48h report' : '২৪–৪৮ ঘণ্টায় রিপোর্ট'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full lg:w-auto">
            <Link
              href="/audit"
              className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider text-center transition inline-flex items-center justify-center gap-2"
            >
              <span>{locale === 'en' ? 'Request Free Audit' : 'ফ্রি অডিট নিন'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="px-6 py-3.5 rounded-xl border border-slate-700 hover:bg-hoooplaaa-navy-800 text-slate-200 font-semibold text-xs text-center transition"
            >
              {locale === 'en' ? 'How It Works' : 'কাজের প্রক্রিয়া'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
