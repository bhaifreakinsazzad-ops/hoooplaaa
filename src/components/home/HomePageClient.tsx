'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useApp } from '@/components/providers/AppProviders';
import { BRAND_V3, PARTNER_ECOSYSTEM_BOUNDARIES } from '@/domain/brand-v3';
import {
  V3_BUNDLES,
  V3_CORE_SERVICES,
  V3_DEPARTMENTS,
  V3_VARIANTS,
  formatBdt,
  getActivePricingWindow,
  getEffectivePriceMinor,
} from '@/domain/catalog';
import { ServiceCard } from '@/components/ServiceCard';
import {
  AnimeCtaLink,
  AnimeReveal,
  AnimeStaggerGrid,
  HeroChoreography,
} from '@/components/motion/AnimeMotion';
import { ArrowRight, Check, Layers, ShieldCheck, Compass } from 'lucide-react';
import { HeroSceneLoader } from '@/components/three/HeroSceneLoader';

// Client-only dynamic import for Three.js hero backdrop with dark-luxury loading state
const HeroMomentumCanvas = dynamic(
  () => import('@/components/three/HeroMomentumCanvas').then((m) => m.HeroMomentumCanvas),
  {
    ssr: false,
    loading: () => <HeroSceneLoader visible />,
  }
);

export function HomePageClient() {
  const { locale } = useApp();
  const [selectedDeptId, setSelectedDeptId] = useState<string>(V3_DEPARTMENTS[0].id);

  const pricingWindow = getActivePricingWindow();
  const heroBundle = V3_BUNDLES[0]; // PK01 Complete 3-Platform Business Setup
  const heroBundlePrice = getEffectivePriceMinor(heroBundle);
  const heroBundleRegular = heroBundle.regularPriceMinor ?? heroBundle.basePriceMinor;

  const vaTiers = useMemo(
    () => V3_VARIANTS.filter((v) => v.parentSku === 'V01'),
    []
  );

  const departmentServices = useMemo(
    () => V3_CORE_SERVICES.filter((s) => s.categoryId === selectedDeptId),
    [selectedDeptId]
  );

  const activeDepartment = useMemo(
    () => V3_DEPARTMENTS.find((d) => d.id === selectedDeptId) ?? V3_DEPARTMENTS[0],
    [selectedDeptId]
  );

  return (
    <div className="bg-brand-ivory text-brand-ink">
      {/* =====================================================================
          SECTION 1: FULL-BLEED MIDNIGHT FOREST DARK LUXURY HERO WITH THREE.JS
         ===================================================================== */}
      <section className="relative overflow-hidden bg-brand-forest text-brand-platinum">
        {/* Procedural 3D Three.js Momentum Sculpture Backdrop */}
        <HeroMomentumCanvas />

        {/* Balanced directional legibility scrim (no backdrop-filter over WebGL canvas) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(98deg, rgba(2,27,22,0.90) 0%, rgba(2,27,22,0.68) 46%, rgba(2,27,22,0.28) 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(2,27,22,0.20) 0%, rgba(2,27,22,0) 24%, rgba(2,27,22,0.52) 100%)',
          }}
        />

        <HeroChoreography className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left Column: Preserved Official Landscape Logo + Editorial Headline + CTAs */}
            <div className="lg:col-span-7 space-y-6">
              {/* Active Commercial Window Line (unboxed, truthful) */}
              <p
                data-hero-eyebrow
                className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold"
              >
                {locale === 'bn' ? pricingWindow.labelBn : pricingWindow.labelEn}
              </p>

              {/* Preserved Official Landscape Raster Logo with >= 8% clear space */}
              <div
                data-hero-logo
                className="inline-block max-w-[340px] border border-brand-gold/30 bg-brand-forest/95 p-4 shadow-forest-card sm:max-w-[400px] sm:p-5"
              >
                <Image
                  src={BRAND_V3.assets.landscapeLogo}
                  alt="HOOOPLAAA INCORPORATED — Marketing • Sales • Growth"
                  width={BRAND_V3.assets.landscapeLogoWidth}
                  height={BRAND_V3.assets.landscapeLogoHeight}
                  priority
                  referrerPolicy="no-referrer"
                  className="h-auto w-full object-contain"
                />
              </div>

              {/* Expanding Champagne-Gold Architectural Hairline Rule */}
              <div
                data-hero-rule
                aria-hidden="true"
                className="h-px w-28 origin-left bg-gradient-to-r from-brand-gold via-brand-softgold to-transparent"
              />

              <h1 className="font-serif text-4xl font-semibold leading-[1.12] tracking-tight text-brand-ivory sm:text-5xl lg:text-[3.5rem]">
                <span data-hero-headline-line className="block">
                  {locale === 'bn' ? 'পরিমিত অগ্রগতি।' : 'Measured Momentum.'}
                </span>
                <span data-hero-headline-line className="block text-brand-softgold">
                  {locale === 'bn'
                    ? 'সুস্পষ্ট স্কোপে ডিজিটাল গ্রোথ।'
                    : 'Structured Digital Growth.'}
                </span>
              </h1>

              <p
                data-hero-copy
                className="max-w-2xl text-base leading-relaxed text-brand-platinum/85 sm:text-lg"
              >
                {locale === 'bn'
                  ? 'বিজনেস সেটআপ, ডিজিটাল অ্যাডভার্টাইজিং, HOOOPLAAA VA+ ম্যানেজড সাপোর্ট, সিআরএম, অডিয়েন্স ইন্টেলিজেন্স এবং ট্র্যাকিং অ্যানালিটিক্স—সবকিছু স্পষ্ট BDT মূল্যে এবং সরাসরি সেলফ-সার্ভিস কোটেশনে।'
                  : 'Six specialist departments covering Business Setup, Digital Advertising, HOOOPLAAA VA+ Managed Support, Leads & CRM, Audience Intelligence, and Tracking Analytics—configured online with authoritative BDT quotes.'}
              </p>

              {/* Primary + Secondary CTAs with Anime.js hover micro-choreography */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <AnimeCtaLink
                  href="/build"
                  choreograph
                  className="inline-flex items-center gap-2.5 bg-brand-gold px-7 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-brand-forest transition-colors hover:bg-brand-softgold"
                >
                  <span>{locale === 'bn' ? 'প্যাকেজ তৈরি করুন' : 'Build Your Package'}</span>
                  <ArrowRight data-cta-arrow className="h-4 w-4" />
                </AnimeCtaLink>
                <AnimeCtaLink
                  href="/services"
                  choreograph
                  className="inline-flex items-center gap-2 border border-brand-gold/45 bg-brand-forest/65 px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-ivory transition-colors hover:border-brand-gold hover:bg-brand-teal/55"
                >
                  <span>{locale === 'bn' ? '৫৭টি সার্ভিস দেখুন' : 'Explore All 57 Services'}</span>
                </AnimeCtaLink>
              </div>

              {/* Unboxed Governance Highlights */}
              <div
                data-hero-meta
                className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-brand-gold/20 pt-5 text-xs text-brand-platinum/80"
              >
                <span>{locale === 'bn' ? '৬টি অনুমোদিত বিভাগ' : '6 Approved Departments'}</span>
                <span className="text-brand-gold">·</span>
                <span>{locale === 'bn' ? '১০০% ক্লায়েন্ট মালিকানা' : '100% Client Asset Ownership'}</span>
                <span className="text-brand-gold">·</span>
                <span>{locale === 'bn' ? 'সার্ভার-ভেরিফাইড BDT কোট' : 'Server-Authoritative BDT Quotes'}</span>
              </div>
            </div>

            {/* Right Column: Hero Signature Bundle Card (PK01) */}
            <div className="lg:col-span-5">
              <div
                data-hero-card
                className="border border-brand-gold/40 border-t-2 border-t-brand-gold bg-brand-forest/95 p-7 shadow-forest-card sm:p-8"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-softgold">
                  PK01 · {locale === 'bn' ? 'সিগনেচার সেটআপ বান্ডেল' : 'Signature Launch Bundle'}
                </p>

                <h2 className="mt-2 font-serif text-2xl font-semibold text-brand-ivory">
                  {locale === 'bn' ? heroBundle.nameBn : heroBundle.name}
                </h2>

                <p className="mt-2.5 text-sm leading-relaxed text-brand-platinum/80">
                  {locale === 'bn' ? heroBundle.shortDescriptionBn : heroBundle.shortDescription}
                </p>

                <div className="mt-6 flex items-baseline justify-between border-y border-brand-gold/20 py-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-softgold">
                      {pricingWindow.isLaunchActive
                        ? locale === 'bn'
                          ? '২০২৬ লঞ্চ অফার'
                          : '2026 Launch Offer'
                        : locale === 'bn'
                        ? 'স্ট্যান্ডার্ড লিস্ট রেট'
                        : 'Standard List Rate'}
                    </p>
                    <p className="tabular-price mt-0.5 text-4xl font-bold text-brand-ivory">
                      {formatBdt(heroBundlePrice)}
                    </p>
                  </div>
                  {pricingWindow.isLaunchActive && (
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-brand-platinum/65">
                        {locale === 'bn' ? 'স্ট্যান্ডার্ড লিস্ট রেট' : 'Standard List Rate'}
                      </p>
                      <p className="tabular-price text-base font-semibold text-brand-platinum/80">
                        {formatBdt(heroBundleRegular)}
                      </p>
                    </div>
                  )}
                </div>

                <ul className="mt-5 space-y-2.5 text-sm text-brand-platinum/90">
                  {heroBundle.inclusions.map((item, idx) => (
                    <li
                      key={idx}
                      data-hero-card-item
                      className="flex items-start gap-2.5"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <AnimeCtaLink
                    href="/build?preset=PK01"
                    className="inline-flex flex-1 items-center justify-center gap-2 bg-brand-gold px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-brand-forest transition-colors hover:bg-brand-softgold"
                  >
                    <span>{locale === 'bn' ? 'PK01 কনফিগার করুন' : 'Configure PK01'}</span>
                    <ArrowRight data-cta-arrow className="h-4 w-4" />
                  </AnimeCtaLink>
                  <AnimeCtaLink
                    href="/audit"
                    className="inline-flex items-center justify-center border border-brand-gold/35 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand-ivory transition-colors hover:border-brand-gold"
                  >
                    {locale === 'bn' ? 'ফ্রি অডিট' : 'Free Audit'}
                  </AnimeCtaLink>
                </div>
              </div>
            </div>
          </div>
        </HeroChoreography>
      </section>

      {/* =====================================================================
          SECTION 2: SIX APPROVED DEPARTMENTS (IVORY ARCHITECTURAL DIRECTORY)
         ===================================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <AnimeReveal>
          <div className="flex flex-col justify-between gap-6 border-b border-brand-hairline pb-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
                {locale === 'bn' ? 'সার্ভিস আর্কিটেকচার v3.0' : 'Service Architecture v3.0'}
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-brand-forest sm:text-4xl">
                {locale === 'bn'
                  ? '৬টি অনুমোদিত বিভাগ, ২৬টি কোর সার্ভিস'
                  : 'Six Approved Departments, Twenty-Six Core Services'}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted sm:text-base">
                {locale === 'bn'
                  ? 'প্রতিটি সার্ভিসে নির্ধারিত স্কোপ, স্পষ্ট ডেলিভারেবল এবং লঞ্চ বনাম স্ট্যান্ডার্ড লিস্ট রেট উল্লেখিত রয়েছে।'
                  : 'Every service is published with explicit scope boundaries, tangible deliverables, and authoritative BDT pricing under Revision 4.4.'}
              </p>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-forest hover:text-brand-emerald"
            >
              <span>{locale === 'bn' ? 'সম্পূর্ণ ক্যাটালগ দেখুন' : 'View Full 57-Row Catalog'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </AnimeReveal>

        {/* Department Selector Tabs (01–06) */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {V3_DEPARTMENTS.map((dept) => {
            const active = dept.id === selectedDeptId;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => setSelectedDeptId(dept.id)}
                className={`border p-4 text-left transition-colors ${
                  active
                    ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                    : 'border-brand-hairline bg-white text-brand-ink hover:border-brand-gold'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`font-serif text-xs font-semibold tracking-[0.18em] ${
                      active ? 'text-brand-gold' : 'text-brand-emerald'
                    }`}
                  >
                    {dept.code}.
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider ${
                      active ? 'text-brand-platinum/75' : 'text-brand-muted'
                    }`}
                  >
                    {V3_CORE_SERVICES.filter((s) => s.categoryId === dept.id).length}{' '}
                    {locale === 'bn' ? 'সার্ভিস' : 'services'}
                  </span>
                </div>
                <p className="mt-1.5 font-serif text-base font-semibold">
                  {locale === 'bn' ? dept.nameBn : dept.name}
                </p>
                <p
                  className={`mt-1 text-xs leading-relaxed ${
                    active ? 'text-brand-platinum/80' : 'text-brand-muted'
                  }`}
                >
                  {locale === 'bn' ? dept.summaryBn : dept.summary}
                </p>
              </button>
            );
          })}
        </div>

        {/* Selected Department Live Services */}
        <div className="mt-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-xl font-semibold text-brand-forest">
              {activeDepartment.code}. {locale === 'bn' ? activeDepartment.nameBn : activeDepartment.name}
            </h3>
            <Link
              href={`/services?dept=${activeDepartment.id}`}
              className="text-xs font-semibold uppercase tracking-wider text-brand-emerald hover:underline"
            >
              {locale === 'bn' ? 'এই বিভাগের সব সার্ভিস' : 'Filter in Catalog'} →
            </Link>
          </div>
          <AnimeStaggerGrid
            key={selectedDeptId}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {departmentServices.slice(0, 6).map((srv) => (
              <ServiceCard key={srv.sku} service={srv} compact={departmentServices.length > 4} />
            ))}
          </AnimeStaggerGrid>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: SIGNATURE BUNDLES (PK01–PK03) & HOOOPLAAA VA+ TIERS
         ===================================================================== */}
      <section className="border-y border-brand-gold/25 bg-brand-forest py-16 text-brand-platinum lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimeReveal>
            <div className="flex flex-col justify-between gap-4 border-b border-brand-gold/20 pb-8 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-softgold">
                  {locale === 'bn' ? 'সমন্বিত প্যাকেজ ও ম্যানেজড সাপোর্ট' : 'Curated Packages & Managed Support'}
                </p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-brand-ivory sm:text-4xl">
                  {locale === 'bn'
                    ? '৩টি সিগনেচার বান্ডেল এবং HOOOPLAAA VA+'
                    : 'Three Signature Bundles & HOOOPLAAA VA+ Tiers'}
                </h2>
              </div>
              <Link
                href="/packages"
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gold hover:text-brand-softgold"
              >
                <span>{locale === 'bn' ? 'সব বান্ডেল ও VA+ তুলনা করুন' : 'Compare Bundles & VA+'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </AnimeReveal>

          {/* 3 Signature Bundles */}
          <AnimeStaggerGrid className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {V3_BUNDLES.map((bundle) => {
              const eff = getEffectivePriceMinor(bundle);
              const reg = bundle.regularPriceMinor ?? bundle.basePriceMinor;
              return (
                <div
                  key={bundle.sku}
                  data-anime-item
                  className="flex flex-col justify-between border border-brand-gold/30 bg-brand-teal/40 p-7 transition-colors hover:border-brand-gold"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-softgold">
                      {bundle.sku} · {bundle.bundleComponents?.join(' + ')}
                    </p>
                    <h3 className="mt-2 font-serif text-2xl font-semibold text-brand-ivory">
                      {locale === 'bn' ? bundle.nameBn : bundle.name}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-brand-platinum/80">
                      {locale === 'bn' ? bundle.shortDescriptionBn : bundle.shortDescription}
                    </p>
                    <ul className="mt-5 space-y-2 text-xs text-brand-platinum/90">
                      {bundle.inclusions.map((inc, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-gold" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 border-t border-brand-gold/20 pt-5">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-brand-softgold">
                          {pricingWindow.isLaunchActive ? '2026 Launch Offer' : 'Standard List Rate'}
                        </p>
                        <p className="tabular-price text-3xl font-bold text-brand-ivory">
                          {formatBdt(eff)}
                        </p>
                      </div>
                      {pricingWindow.isLaunchActive && (
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-brand-platinum/60">
                            Standard List
                          </p>
                          <p className="tabular-price text-sm font-semibold text-brand-platinum/80">
                            {formatBdt(reg)}
                          </p>
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/build?preset=${bundle.sku}`}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-brand-gold py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-brand-forest transition-colors hover:bg-brand-softgold"
                    >
                      <span>{locale === 'bn' ? 'বান্ডেল নির্বাচন করুন' : `Select ${bundle.sku}`}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </AnimeStaggerGrid>

          {/* HOOOPLAAA VA+ 4-Tier Strip */}
          <div className="mt-14 border border-brand-gold/25 bg-brand-forest/80 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
                  V01 · Human-Led, Expert-Backed, AI-Assisted
                </p>
                <h3 className="mt-1.5 font-serif text-2xl font-semibold text-brand-ivory">
                  {locale === 'bn'
                    ? 'HOOOPLAAA VA+ ম্যানেজড ডিজিটাল সাপোর্ট'
                    : 'HOOOPLAAA VA+ Managed Digital Support'}
                </h3>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-brand-platinum/75 sm:text-sm">
                  {locale === 'bn'
                    ? BRAND_V3.commercialWindow.subscriptionIntroNoteBn
                    : BRAND_V3.commercialWindow.subscriptionIntroNoteEn}
                </p>
              </div>
              <Link
                href="/packages#va-plus"
                className="shrink-0 text-xs font-semibold uppercase tracking-wider text-brand-softgold hover:text-brand-ivory"
              >
                {locale === 'bn' ? 'সব স্তর দেখুন →' : 'Full Tier Matrix →'}
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {vaTiers.map((tier) => {
                const eff = getEffectivePriceMinor(tier);
                const reg = tier.regularPriceMinor ?? tier.basePriceMinor;
                const shortTierName = tier.name.replace('HOOOPLAAA VA+ — ', '');
                return (
                  <div
                    key={tier.sku}
                    className="flex flex-col justify-between border border-brand-teal bg-brand-teal/25 p-5"
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-softgold">
                        {tier.sku}
                      </p>
                      <h4 className="mt-1 font-serif text-xl font-semibold text-brand-ivory">
                        {shortTierName}
                      </h4>
                      <p className="mt-2 text-xs leading-relaxed text-brand-platinum/80">
                        {locale === 'bn' ? tier.allowanceBn ?? tier.allowance : tier.allowance}
                      </p>
                    </div>
                    <div className="mt-5 border-t border-brand-teal pt-4">
                      <p className="tabular-price text-2xl font-bold text-brand-gold">
                        {formatBdt(eff)}
                        <span className="text-xs font-normal text-brand-platinum/70">/mo (1st mo)</span>
                      </p>
                      <p className="tabular-price mt-0.5 text-[11px] text-brand-platinum/65">
                        Standard List: {formatBdt(reg)}/mo
                      </p>
                      <Link
                        href={`/build?sku=${tier.sku}`}
                        className="mt-3 block border border-brand-gold/40 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-brand-ivory transition-colors hover:border-brand-gold hover:bg-brand-gold hover:text-brand-forest"
                      >
                        {locale === 'bn' ? 'কনফিগার করুন' : 'Configure Tier'}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: BRAND PILLARS + PARTNER ECOSYSTEM BOUNDARY + FREE AUDIT
         ===================================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        {/* 3 Brand Pillars */}
        <AnimeReveal>
          <div className="grid grid-cols-1 gap-6 border-b border-brand-hairline pb-14 md:grid-cols-3">
            {BRAND_V3.pillars.map((pillar, index) => (
              <div key={pillar.name} className="border border-brand-hairline bg-white p-6">
                <p className="font-serif text-xs font-semibold tracking-[0.18em] text-brand-gold">
                  0{index + 1}. {locale === 'bn' ? pillar.meaningBn : pillar.meaning}
                </p>
                <h3 className="mt-2 font-serif text-2xl font-semibold text-brand-forest">
                  {locale === 'bn' ? pillar.nameBn : pillar.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                  {locale === 'bn' ? pillar.detailBn : pillar.detail}
                </p>
              </div>
            ))}
          </div>
        </AnimeReveal>

        {/* Partner Ecosystem Boundary Clarity */}
        <AnimeReveal delay={80} className="mt-14">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
                {locale === 'bn' ? 'স্বচ্ছ ইকোসিস্টেম সীমারেখা' : 'Clear Ecosystem Boundaries'}
              </p>
              <h2 className="font-serif text-3xl font-semibold text-brand-forest">
                {locale === 'bn'
                  ? 'HOOOPLAAA কী করে এবং পার্টনার কোম্পানি কী করে'
                  : 'What HOOOPLAAA Owns vs. Specialist Partner Companies'}
              </h2>
              <p className="text-sm leading-relaxed text-brand-muted">
                {locale === 'bn'
                  ? 'ব্র্যান্ড গভর্ন্যান্স অনুযায়ী HOOOPLAAA-এর সেলফ-চেকআউটে শুধুমাত্র HOOOPLAAA-নিজস্ব ডিজিটাল মার্কেটিং ও সাপোর্ট সার্ভিস বিক্রি হয়। গ্রাফিক ডিজাইন, কাস্টম সফটওয়্যার ও SaaS আলাদা পার্টনার স্কোপে পরিচালিত হয়।'
                  : 'To keep scope disciplined and transparent, HOOOPLAAA checkout covers only HOOOPLAAA-owned marketing, VA+, lead, CRM, intelligence, and tracking services. Creative production, custom software, and SaaS are scoped separately with specialist partners.'}
              </p>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PARTNER_ECOSYSTEM_BOUNDARIES.map((item) => (
                <div
                  key={item.brand}
                  className={`border p-5 ${
                    item.role === 'owned'
                      ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                      : 'border-brand-hairline bg-white text-brand-ink'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-serif text-lg font-semibold">
                      {locale === 'bn' ? item.brandBn : item.brand}
                    </h3>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        item.role === 'owned' ? 'text-brand-gold' : 'text-brand-muted'
                      }`}
                    >
                      {item.role === 'owned'
                        ? locale === 'bn'
                          ? 'এই প্ল্যাটফর্মে'
                          : 'Platform Checkout'
                        : locale === 'bn'
                        ? 'পৃথক পার্টনার'
                        : 'Separate Partner'}
                    </span>
                  </div>
                  <p
                    className={`mt-2 text-xs leading-relaxed ${
                      item.role === 'owned' ? 'text-brand-platinum/85' : 'text-brand-muted'
                    }`}
                  >
                    {locale === 'bn' ? item.ownsBn : item.owns}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </AnimeReveal>

        {/* Bottom Readiness Audit Callout */}
        <AnimeReveal delay={120} className="mt-16">
          <div className="flex flex-col items-start justify-between gap-6 border border-brand-gold/40 bg-brand-forest p-8 text-brand-ivory sm:flex-row sm:items-center sm:p-10">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-softgold">
                {locale === 'bn' ? 'প্রাক-ক্রয় প্রস্তুতি যাচাই' : 'Pre-Purchase Readiness Check'}
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">
                {locale === 'bn'
                  ? 'কোন সার্ভিসটি আপনার ব্যবসার জন্য সঠিক বুঝতে পারছেন না?'
                  : 'Unsure which department or bundle fits your current stage?'}
              </h2>
              <p className="mt-2 text-sm text-brand-platinum/80">
                {locale === 'bn'
                  ? 'বিনামূল্যে প্রাথমিক ডিজিটাল রিডিনেস অডিটের জন্য অনুরোধ করুন অথবা সরাসরি প্যাকেজ বিল্ডারে রিয়েল-টাইম এলিজিবিলিটি যাচাই করুন।'
                  : 'Request a complimentary initial readiness audit or run instant automated eligibility checks inside our Package Configurator.'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/audit"
                className="bg-brand-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-brand-forest hover:bg-brand-softgold"
              >
                {locale === 'bn' ? 'ফ্রি অডিট অনুরোধ' : 'Request Free Audit'}
              </Link>
              <Link
                href="/build"
                className="border border-brand-gold/45 px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand-ivory hover:border-brand-gold"
              >
                {locale === 'bn' ? 'প্যাকেজ বিল্ডার' : 'Open Configurator'}
              </Link>
            </div>
          </div>
        </AnimeReveal>

        {/* Subtle feature strip icons using Lucide */}
        <div className="mt-12 grid grid-cols-1 gap-4 text-xs text-brand-muted sm:grid-cols-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-brand-emerald" />
            <span>
              {locale === 'bn'
                ? 'SHA-256 অপরিবর্তনীয় টার্মস ও স্কোপ স্ন্যাপশট'
                : 'SHA-256 immutable scope & terms snapshot on every quote'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-brand-emerald" />
            <span>
              {locale === 'bn'
                ? 'বান্ডেল ও অ্যালিয়াস অটোমেটিক ডি-ডুপ্লিকেশন'
                : 'Automatic bundle component & X05 alias deduplication'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Compass className="h-4 w-4 text-brand-emerald" />
            <span>
              {locale === 'bn'
                ? 'Asia/Dhaka ব্যবসায়িক দিনের নির্ভুল SLA ট্র্যাকিং'
                : 'Asia/Dhaka business-day SLA tracking post payment & intake'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
