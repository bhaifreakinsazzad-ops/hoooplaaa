'use client';

import React from 'react';
import Link from 'next/link';
import { Service } from '@/domain/types';
import { formatBdt, getActivePricingWindow, getEffectivePriceMinor } from '@/domain/catalog';
import { useApp } from '@/components/providers/AppProviders';
import { ArrowRight, Check } from 'lucide-react';

interface ServiceCardProps {
  service: Service;
  compact?: boolean;
}

export function ServiceCard({ service, compact = false }: ServiceCardProps) {
  const { locale } = useApp();
  const pricingWindow = getActivePricingWindow();
  const effectiveMinor = getEffectivePriceMinor(service);
  const regularMinor = service.regularPriceMinor ?? service.basePriceMinor;
  const showLaunchContrast =
    pricingWindow.isLaunchActive &&
    typeof service.launchPriceMinor === 'number' &&
    typeof service.regularPriceMinor === 'number' &&
    service.regularPriceMinor > service.launchPriceMinor;

  const billingLabel =
    service.billingPeriod === 'monthly'
      ? locale === 'bn'
        ? 'মাসিক (১ম মাস অফার)'
        : 'Monthly · 1st mo offer'
      : service.billingPeriod === 'variable'
      ? locale === 'bn'
        ? 'স্কোপভিত্তিক'
        : 'Scoped modes'
      : locale === 'bn'
      ? 'এককালীন'
      : 'One-time';

  return (
    <article
      data-anime-item
      className="group flex flex-col justify-between border border-brand-hairline bg-white p-6 transition-colors duration-200 hover:border-brand-gold"
    >
      <div>
        {/* Zero-pill unboxed metadata line */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-emerald">
          {service.sku} · {billingLabel}
          {service.deliveryTarget ? ` · ${service.deliveryTarget}` : ''}
        </p>

        {/* Title */}
        <h3 className="mt-2.5 font-serif text-lg font-semibold leading-snug text-brand-forest">
          {locale === 'bn' ? service.nameBn : service.name}
        </h3>

        {/* Concise description */}
        <p className="mt-2 text-sm leading-relaxed text-brand-muted">
          {locale === 'bn' ? service.shortDescriptionBn : service.shortDescription}
        </p>

        {/* Allowance note for VA+ tiers */}
        {service.allowance && (
          <p className="mt-2.5 text-xs font-medium text-brand-ink">
            {locale === 'bn' ? service.allowanceBn ?? service.allowance : service.allowance}
          </p>
        )}

        {/* Bundle components or top 2 inclusions */}
        {!compact && service.inclusions.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-brand-hairline/70 pt-3.5 text-xs text-brand-ink/90">
            {service.inclusions.slice(0, 3).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-emerald" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pricing & Actions */}
      <div className="mt-6 border-t border-brand-hairline pt-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
              {showLaunchContrast
                ? locale === 'bn'
                  ? '২০২৬ লঞ্চ মূল্য'
                  : '2026 Launch Offer'
                : locale === 'bn'
                ? 'স্ট্যান্ডার্ড লিস্ট রেট'
                : 'Standard List Rate'}
            </p>
            <p className="tabular-price mt-0.5 text-2xl font-bold tracking-tight text-brand-forest">
              {service.isFromPrice ? (locale === 'bn' ? 'শুরু ' : 'From ') : ''}
              {formatBdt(effectiveMinor)}
              {service.billingPeriod === 'monthly' && (
                <span className="text-xs font-medium text-brand-muted">
                  {locale === 'bn' ? '/মাস' : '/mo'}
                </span>
              )}
            </p>
          </div>

          {showLaunchContrast && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-brand-muted">
                {locale === 'bn' ? 'স্ট্যান্ডার্ড রেট' : 'Standard List'}
              </p>
              <p className="tabular-price text-sm font-semibold text-brand-muted">
                {formatBdt(regularMinor)}
                {service.billingPeriod === 'monthly' ? (locale === 'bn' ? '/মাস' : '/mo') : ''}
              </p>
            </div>
          )}
        </div>

        {service.billingPeriod === 'monthly' && (
          <p className="mt-2 text-[11px] text-brand-muted">
            {locale === 'bn'
              ? '১ম মাসের লঞ্চ অফার; ২য় মাস থেকে সম্মতিতে স্ট্যান্ডার্ড রেট।'
              : 'Launch rate applies to Month 1 only; standard renewal with consent.'}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/services/${service.slug}`}
            className="flex-1 border border-brand-forest/25 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-brand-forest transition-colors hover:border-brand-forest hover:bg-brand-ivory"
          >
            {locale === 'bn' ? 'বিস্তারিত' : 'Details'}
          </Link>
          <Link
            href={`/build?sku=${encodeURIComponent(service.sku)}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 bg-brand-forest px-3 py-2 text-xs font-semibold uppercase tracking-wider text-brand-ivory transition-colors hover:bg-brand-teal"
          >
            <span>{locale === 'bn' ? 'নির্বাচন' : 'Configure'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
