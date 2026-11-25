'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/components/providers/AppProviders';
import { BRAND_V3 } from '@/domain/brand-v3';
import {
  V3_BUNDLES,
  V3_VARIANTS,
  formatBdt,
  getActivePricingWindow,
  getEffectivePriceMinor,
} from '@/domain/catalog';
import { AnimeReveal, AnimeStaggerGrid } from '@/components/motion/AnimeMotion';
import { ArrowRight, Check } from 'lucide-react';

export default function PackagesPage() {
  const { locale } = useApp();
  const pricingWindow = getActivePricingWindow();

  const adModes = V3_VARIANTS.filter((v) => v.parentSku === 'A01');
  const vaTiers = V3_VARIANTS.filter((v) => v.parentSku === 'V01');

  return (
    <div className="bg-brand-ivory text-brand-ink">
      {/* Midnight Forest Header */}
      <section className="border-b border-brand-gold/25 bg-brand-forest py-14 text-brand-platinum">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
            {locale === 'bn' ? pricingWindow.labelBn : pricingWindow.labelEn}
          </p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-brand-ivory sm:text-5xl">
            {locale === 'bn'
              ? 'সিগনেচার বান্ডেল, অ্যাডভার্টাইজিং মোড ও HOOOPLAAA VA+'
              : 'Signature Bundles, Advertising Modes & HOOOPLAAA VA+'}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-platinum/80 sm:text-base">
            {locale === 'bn'
              ? 'সকল বান্ডেলে অন্তর্ভুক্ত সার্ভিসগুলোর জন্য স্বয়ংক্রিয়ভাবে কোনো ডাবল বিলিং হয় না। মাসিক সার্ভিসের লঞ্চ অফার শুধুমাত্র প্রথম মাসের জন্য প্রযোজ্য।'
              : 'Component deduplication is enforced server-side across all signature bundles. Monthly launch pricing applies to Month 1 only with explicit standard renewal consent.'}
          </p>
        </div>
      </section>

      {/* Section 1: 3 Signature Bundles */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <AnimeReveal>
          <div className="border-b border-brand-hairline pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
              01. {locale === 'bn' ? 'সিগনেচার বান্ডেল' : 'Signature Bundles (PK01 – PK03)'}
            </p>
            <h2 className="mt-1.5 font-serif text-3xl font-semibold text-brand-forest">
              {locale === 'bn'
                ? 'সমন্বিত ওয়ান-টাইম প্যাকেজ'
                : 'Integrated One-Time Setup, Intelligence & Tracking Bundles'}
            </h2>
          </div>
        </AnimeReveal>

        <AnimeStaggerGrid className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {V3_BUNDLES.map((bundle) => {
            const eff = getEffectivePriceMinor(bundle);
            const reg = bundle.regularPriceMinor ?? bundle.basePriceMinor;
            return (
              <div
                key={bundle.sku}
                data-anime-item
                className="flex flex-col justify-between border border-brand-hairline bg-white p-7 transition-colors hover:border-brand-gold"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-emerald">
                    {bundle.sku} · Includes {bundle.bundleComponents?.join(' + ')}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl font-semibold text-brand-forest">
                    {locale === 'bn' ? bundle.nameBn : bundle.name}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-brand-muted">
                    {locale === 'bn' ? bundle.shortDescriptionBn : bundle.shortDescription}
                  </p>

                  <ul className="mt-5 space-y-2 border-t border-brand-hairline pt-4 text-xs text-brand-ink">
                    {bundle.inclusions.map((inc, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-emerald" />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 border-t border-brand-hairline pt-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
                        {pricingWindow.isLaunchActive ? '2026 Launch Offer' : 'Standard List Rate'}
                      </p>
                      <p className="tabular-price text-3xl font-bold text-brand-forest">
                        {formatBdt(eff)}
                      </p>
                    </div>
                    {pricingWindow.isLaunchActive && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-brand-muted">
                          Standard List
                        </p>
                        <p className="tabular-price text-sm font-semibold text-brand-muted">
                          {formatBdt(reg)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Link
                      href={`/services/${bundle.slug}`}
                      className="flex-1 border border-brand-forest/25 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-brand-forest hover:bg-brand-ivory"
                    >
                      {locale === 'bn' ? 'বিস্তারিত' : 'Details'}
                    </Link>
                    <Link
                      href={`/build?preset=${bundle.sku}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 bg-brand-forest py-2.5 text-xs font-bold uppercase tracking-wider text-brand-ivory hover:bg-brand-teal"
                    >
                      <span>{locale === 'bn' ? 'নির্বাচন' : 'Configure'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </AnimeStaggerGrid>
      </section>

      {/* Section 2: HOOOPLAAA VA+ 4-Tier Matrix */}
      <section id="va-plus" className="border-y border-brand-gold/25 bg-brand-forest py-16 text-brand-platinum">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-softgold">
            02. V01 · Human-Led, Expert-Backed, AI-Assisted
          </p>
          <h2 className="mt-1.5 font-serif text-3xl font-semibold text-brand-ivory">
            {locale === 'bn'
              ? 'HOOOPLAAA VA+ | ম্যানেজড ডিজিটাল সাপোর্ট স্তর'
              : 'HOOOPLAAA VA+ | Four Clear Monthly Capacity Tiers'}
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-brand-platinum/80 sm:text-sm">
            {locale === 'bn'
              ? BRAND_V3.commercialWindow.subscriptionIntroNoteBn
              : BRAND_V3.commercialWindow.subscriptionIntroNoteEn}
          </p>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {vaTiers.map((tier) => {
              const eff = getEffectivePriceMinor(tier);
              const reg = tier.regularPriceMinor ?? tier.basePriceMinor;
              const tierShort = tier.name.replace('HOOOPLAAA VA+ — ', '');
              return (
                <div
                  key={tier.sku}
                  className="flex flex-col justify-between border border-brand-gold/30 bg-brand-teal/35 p-6"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-softgold">
                      {tier.sku}
                    </p>
                    <h3 className="mt-1 font-serif text-2xl font-semibold text-brand-ivory">
                      {tierShort}
                    </h3>
                    <p className="mt-2 text-xs font-medium text-brand-softgold">
                      {locale === 'bn' ? tier.allowanceBn ?? tier.allowance : tier.allowance}
                    </p>
                    <ul className="mt-4 space-y-2 border-t border-brand-gold/20 pt-4 text-xs text-brand-platinum/85">
                      {tier.inclusions.map((inc, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-gold" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 border-t border-brand-gold/20 pt-4">
                    <p className="text-[10px] uppercase tracking-wider text-brand-softgold">
                      {pricingWindow.isLaunchActive ? 'Month 1 Launch Offer' : 'Standard Monthly Rate'}
                    </p>
                    <p className="tabular-price mt-0.5 text-3xl font-bold text-brand-ivory">
                      {formatBdt(eff)}
                      <span className="text-xs font-normal text-brand-platinum/75">/mo</span>
                    </p>
                    {pricingWindow.isLaunchActive && (
                      <p className="tabular-price mt-0.5 text-xs text-brand-platinum/70">
                        Standard List: {formatBdt(reg)}/mo from Month 2
                      </p>
                    )}
                    <Link
                      href={`/build?sku=${tier.sku}`}
                      className="mt-4 block bg-brand-gold py-2.5 text-center text-xs font-bold uppercase tracking-wider text-brand-forest hover:bg-brand-softgold"
                    >
                      {locale === 'bn' ? 'নির্বাচন করুন' : `Select ${tierShort}`}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 3: Digital Advertising Delivery Modes (A01) */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="border-b border-brand-hairline pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
            03. A01 · {locale === 'bn' ? 'ডিজিটাল অ্যাডভার্টাইজিং মোড' : 'Digital Advertising Delivery Modes'}
          </p>
          <h2 className="mt-1.5 font-serif text-3xl font-semibold text-brand-forest">
            {locale === 'bn'
              ? 'ওয়ান-টাইম সেটআপ বনাম মাসিক ক্যাম্পেইন ম্যানেজমেন্ট'
              : 'One-Time Campaign Setup vs. Ongoing Monthly Management'}
          </h2>
          <p className="mt-2 text-xs text-brand-muted">
            Paid media budgets are funded directly by the client inside Meta, Google, or LinkedIn ad accounts.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {adModes.map((mode) => {
            const eff = getEffectivePriceMinor(mode);
            const reg = mode.regularPriceMinor ?? mode.basePriceMinor;
            return (
              <div
                key={mode.sku}
                className="flex flex-col justify-between border border-brand-hairline bg-white p-7"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-emerald">
                    {mode.sku} · {mode.billingPeriod === 'monthly' ? 'Monthly (1st Month Offer)' : 'One-Time Setup'}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl font-semibold text-brand-forest">
                    {locale === 'bn' ? mode.nameBn : mode.name}
                  </h3>
                  <p className="mt-2 text-sm text-brand-muted">
                    {locale === 'bn' ? mode.shortDescriptionBn : mode.shortDescription}
                  </p>
                  <ul className="mt-4 space-y-2 border-t border-brand-hairline pt-4 text-xs text-brand-ink">
                    {mode.inclusions.map((inc, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-emerald" />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 flex items-end justify-between border-t border-brand-hairline pt-5">
                  <div>
                    <p className="tabular-price text-3xl font-bold text-brand-forest">
                      {formatBdt(eff)}
                      {mode.billingPeriod === 'monthly' && (
                        <span className="text-xs font-normal text-brand-muted">/mo</span>
                      )}
                    </p>
                    {pricingWindow.isLaunchActive && (
                      <p className="tabular-price text-xs text-brand-muted">
                        Standard List Rate: {formatBdt(reg)}
                        {mode.billingPeriod === 'monthly' ? '/mo' : ''}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/build?sku=${mode.sku}`}
                    className="inline-flex items-center gap-2 bg-brand-forest px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-ivory hover:bg-brand-teal"
                  >
                    <span>{locale === 'bn' ? 'কনফিগার করুন' : 'Configure'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
