'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/components/providers/AppProviders';
import { CANONICAL_SERVICES } from '@/domain/catalog';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  HelpCircle,
  TrendingUp,
  FileSearch,
  ExternalLink,
  ChevronRight,
  Check,
} from 'lucide-react';

export default function HomePage() {
  const { locale, concept } = useApp();

  const bundle = CANONICAL_SERVICES.find((s) => s.sku === 'HI-BUNDLE-3')!;
  const setups = CANONICAL_SERVICES.filter(
    (s) => s.categoryId === 'cat-setup' && s.sku !== 'HI-BUNDLE-3'
  );
  const addons = CANONICAL_SERVICES.filter((s) => s.categoryId === 'cat-addon');

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-hoooplaaa-navy-950 text-white pt-16 pb-24 px-4 sm:px-6 border-b border-hoooplaaa-navy-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-hoooplaaa-navy-800/40 via-hoooplaaa-navy-950 to-hoooplaaa-navy-950 pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hoooplaaa-navy-800/90 border border-hoooplaaa-gold-500/30 text-xs font-semibold text-hoooplaaa-gold-300">
              <Sparkles className="w-3.5 h-3.5 text-hoooplaaa-gold-400" />
              <span>
                {locale === 'en'
                  ? 'Bangladesh Digital Infrastructure Commerce'
                  : 'ডিজিটাল বিজনেস সেটআপ ও সেলফ-সার্ভিস প্ল্যাটফর্ম'}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15]">
              {locale === 'en' ? (
                <>
                  Build your business foundation.{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-hoooplaaa-gold-300 via-hoooplaaa-gold-400 to-amber-200">
                    Choose what you need.
                  </span>{' '}
                  Order online.
                </>
              ) : (
                <>
                  আপনার ব্যবসার ডিজিটাল ভিত্তি গড়ে তুলুন।{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-hoooplaaa-gold-300 to-amber-200">
                    প্রয়োজনীয় সার্ভিস নির্বাচন করুন।
                  </span>{' '}
                  অনলাইনে নিশ্চিন্তে অর্ডার করুন।
                </>
              )}
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              {locale === 'en'
                ? 'Attract. Connect. Convert. Grow. Professional Meta, Google, and LinkedIn setups with server-authoritative pricing, transparent eligibility checks, and zero human sales friction.'
                : 'অ্যাট্রাক্ট • কানেক্ট • কনভার্ট • গ্রো। মেটা, গুগল এবং লিঙ্কডইনের প্রফেশনাল বিজনেস সেটআপ। স্বচ্ছ মূল্যতালিকা ও নিরাপদ ডেলিগেশন হ্যান্ডওভার।'}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/build"
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-hoooplaaa-gold-500 to-hoooplaaa-gold-600 hover:from-hoooplaaa-gold-400 hover:to-hoooplaaa-gold-500 text-hoooplaaa-navy-950 font-bold text-sm uppercase tracking-wider shadow-gold-glow transition flex items-center gap-2 group"
              >
                <span>{locale === 'en' ? 'Build My Package' : 'প্যাকেজ বিল্ডার শুরু করুন'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/services"
                className="px-6 py-3.5 rounded-xl bg-hoooplaaa-navy-800/80 hover:bg-hoooplaaa-navy-800 border border-slate-700 text-slate-200 font-semibold text-sm transition"
              >
                {locale === 'en' ? 'Explore Approved Services' : 'অনুমোদিত সার্ভিসসমূহ দেখুন'}
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-hoooplaaa-navy-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero Password Exchange</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Fixed BDT Price Snapshots</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Contractual SLA Clock</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Dual Free Audit Workflow</span>
              </div>
            </div>
          </div>

          {/* Hero Bundle Showcase Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-b from-hoooplaaa-navy-900 to-hoooplaaa-navy-950 border-2 border-hoooplaaa-gold-500/40 shadow-2xl relative">
              <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-hoooplaaa-gold-500 text-hoooplaaa-navy-950 text-xs font-black uppercase tracking-widest shadow-md">
                {locale === 'en' ? 'Hero Bundle Offer' : 'হিরো বান্ডেল অফার'}
              </div>

              <div className="space-y-4">
                <span className="text-xs uppercase tracking-wider text-hoooplaaa-gold-400 font-bold">
                  {locale === 'en' ? 'Core Foundation Setup' : 'মূল ডিজিটাল সেটআপ'}
                </span>
                <h3 className="text-2xl font-bold text-white">
                  {locale === 'en' ? bundle.name : bundle.nameBn}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {locale === 'en' ? bundle.shortDescription : bundle.shortDescriptionBn}
                </p>

                <div className="p-4 rounded-xl bg-hoooplaaa-navy-950 border border-hoooplaaa-navy-800 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-extrabold text-white">
                      ৳{(bundle.basePriceMinor / 100).toLocaleString('en-US')}
                    </span>
                    <span className="text-xs text-slate-400 ml-1.5">one-time</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 line-through">৳4,500</span>
                    <span className="text-xs font-bold text-emerald-400 block">
                      Save ৳1,500 (33⅓%)
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-hoooplaaa-gold-400" />
                    <span>Meta Business Portfolio + Facebook Page + IG</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-hoooplaaa-gold-400" />
                    <span>Google Business Profile (Storefront/Service Area)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-hoooplaaa-gold-400" />
                    <span>LinkedIn Corporate Company Page</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-hoooplaaa-gold-400" />
                    <span>Complimentary Post-Sale Detailed Audit</span>
                  </div>
                </div>

                {/* Google Eligibility Callout */}
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block">Google Policy Requirement:</strong>
                    <span>
                      Physical storefront or in-person service area required. Pure online companies
                      are guided to custom scopes.
                    </span>
                  </div>
                </div>

                <Link
                  href="/build?preset=bundle"
                  className="w-full py-3 rounded-xl bg-hoooplaaa-gold-500 hover:bg-hoooplaaa-gold-400 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider text-center block transition shadow-gold-glow"
                >
                  {locale === 'en'
                    ? 'Configure 3-Platform Bundle (৳3,000)'
                    : '৩-প্ল্যাটফর্ম সেটআপ শুরু করুন (৳৩,০০০)'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Approved Core Setup Services */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600 block mb-1">
              {locale === 'en' ? 'Foundational Setups' : 'মৌলিক অবকাঠামো'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {locale === 'en' ? 'Individual Platform Setups' : 'একক প্ল্যাটফর্ম সার্ভিসসমূহ'}
            </h2>
          </div>
          <Link
            href="/services"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 self-start sm:self-auto"
          >
            {locale === 'en' ? 'View Full Scope Documentation' : 'বিস্তারিত স্কোপ দেখুন'}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {setups.map((srv) => (
            <div
              key={srv.id}
              className="rounded-2xl p-6 bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {srv.sku}
                  </span>
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {srv.deliveryTarget}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900">
                  {locale === 'en' ? srv.name : srv.nameBn}
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {locale === 'en' ? srv.shortDescription : srv.shortDescriptionBn}
                </p>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-700">
                  {srv.inclusions.slice(0, 3).map((inc, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{inc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-slate-900">
                    ৳{(srv.basePriceMinor / 100).toLocaleString('en-US')}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-1">one-time</span>
                </div>
                <Link
                  href={`/build?sku=${srv.sku}`}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition"
                >
                  Configure
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Verified Add-on Options */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600 block mb-1">
            {locale === 'en' ? 'Compatible Add-ons' : 'প্রয়োজনীয় অ্যাড-অন'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {locale === 'en' ? 'Growth, Tracking & Creative Upgrades' : 'ট্র্যাকিং ও ক্রিয়েটিভ আপগ্রেড'}
          </h2>
          <p className="text-xs text-slate-600 max-w-xl mt-1">
            {locale === 'en'
              ? 'Select compatible add-ons during configuration. Clear prerequisite rules prevent impossible setups.'
              : 'কনফিগারেশনের সময় আপনার প্রয়োজনীয় অ্যাড-অন যুক্ত করতে পারেন। সঠিক শর্ত পূরণ না হলে ভুল অর্ডার প্রতিহত হয়।'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {addons.map((add) => (
            <div
              key={add.id}
              className="rounded-2xl p-6 bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    {add.sku}
                  </span>
                  <span className="text-xs font-medium text-slate-500">{add.deliveryTarget}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  {locale === 'en' ? add.name : add.nameBn}
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {locale === 'en' ? add.shortDescription : add.shortDescriptionBn}
                </p>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <span className="font-semibold text-slate-800 block">Prerequisite:</span>
                  <span>{add.prerequisites[0]}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold text-slate-900">
                    ৳{(add.basePriceMinor / 100).toLocaleString('en-US')}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-1">one-time</span>
                </div>
                <Link
                  href="/build"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
                >
                  Add to Quote
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white border-y border-slate-200 py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
              {locale === 'en' ? 'Commercial Integrity' : 'কাজের স্বচ্ছ প্রক্রিয়া'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {locale === 'en' ? 'How Self-Service Setup Works' : 'সেলফ-সার্ভিস অর্ডার কীভাবে কাজ করে'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {locale === 'en'
                ? 'From business selection to verified delivery in 4 deterministic steps.'
                : 'সার্ভিস নির্বাচন থেকে যাচাইকৃত ডেলিভারি পর্যন্ত ৪টি সহজ ও স্বচ্ছ ধাপ।'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                {locale === 'en' ? 'Configure & Check Eligibility' : 'কনফিগার ও যোগ্যতা যাচাই'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {locale === 'en'
                  ? 'Answer business profile questions. The server checks Google storefront requirements and Meta page status in real time.'
                  : 'ব্যবসায়িক প্রশ্নের উত্তর দিন। সার্ভার তাৎক্ষণিকভাবে গুগল পলিসি ও মেটা শর্তাবলী যাচাই করবে।'}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                {locale === 'en' ? 'Authoritative Server Quote' : 'সার্ভার-অথরাইজড কোটেশন'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {locale === 'en'
                  ? 'Get an immutable price snapshot in BDT with 7-day validity. Client-side price tampering is completely rejected.'
                  : '৭ দিনের মেয়াদে অপরিবর্তনশীল কোটেশন পান। ব্রাউজারের কোনো মূল্য পরিবর্তন সার্ভারে গ্রাহ্য হয় না।'}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                {locale === 'en' ? 'Verified Checkout' : 'নিরাপদ পেমেন্ট ও ভেরিফিকেশন'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {locale === 'en'
                  ? 'Pay through SSLCOMMERZ sandbox gateway or submit manual bKash/Nagad reference for finance verification.'
                  : 'এসএসএলকমার্জ গেটওয়ে অথবা বিকাশ/নগদ রেফারেন্স জমা দিয়ে নিশ্চিন্তে অর্ডার সম্পন্ন করুন।'}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                4
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                {locale === 'en' ? 'Intake & Handover Handshake' : 'ইনটেক ও হ্যান্ডওভার'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {locale === 'en'
                  ? 'Submit business assets and partner access (no passwords). SLA begins only when requirements are complete.'
                  : 'পাসওয়ার্ড ছাড়াই পার্টনার অ্যাক্সেস দিন। সব তথ্য পাওয়ার পরই অফিসিয়াল এসএলএ সময় গণনা শুরু হয়।'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free Pre-Sale Audit CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-r from-hoooplaaa-navy-950 via-hoooplaaa-navy-900 to-hoooplaaa-navy-950 border border-hoooplaaa-navy-800 text-white flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/60 text-blue-300 text-xs font-semibold border border-blue-700/50">
              <FileSearch className="w-3.5 h-3.5" />
              <span>Complimentary Pre-Sale Analysis</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {locale === 'en'
                ? 'Want to test your current presence first?'
                : 'আপনার বর্তমান ডিজিটাল উপস্থিতি যাচাই করতে চান?'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {locale === 'en'
                ? 'Apply for a Free Initial Business Readiness Audit. We inspect your public Facebook, Google, or website presence for missing foundations without asking for login access.'
                : 'আমাদের ফ্রি ইনিশিয়াল বিজনেস রেডিনেস অডিটের আবেদন করুন। কোনো পাসওয়ার্ড ছাড়াই আপনার পেজ ও ওয়েবসাইটের খামতি চিহ্নিত করা হবে।'}
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Link
              href="/audit"
              className="px-6 py-3.5 rounded-xl bg-white text-slate-950 font-bold text-xs uppercase tracking-wider text-center hover:bg-slate-100 transition shadow-lg"
            >
              {locale === 'en' ? 'Request Free Audit' : 'ফ্রি অডিট রিকোয়েস্ট করুন'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
