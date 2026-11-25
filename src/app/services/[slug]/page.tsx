import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ALL_SERVICES,
  findServiceBySku,
  findServiceBySlug,
  formatBdt,
  getActivePricingWindow,
  getDepartmentById,
  getEffectivePriceMinor,
} from '@/domain/catalog';
import { BRAND_V3 } from '@/domain/brand-v3';
import { ArrowLeft, ArrowRight, Check, Info, XCircle } from 'lucide-react';

export function generateStaticParams() {
  return ALL_SERVICES.filter((s) => s.publicationStatus === 'published').map((s) => ({
    slug: s.slug,
  }));
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = findServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const department = getDepartmentById(service.categoryId);
  const pricingWindow = getActivePricingWindow();
  const effectiveMinor = getEffectivePriceMinor(service);
  const regularMinor = service.regularPriceMinor ?? service.basePriceMinor;
  const showLaunchContrast =
    pricingWindow.isLaunchActive &&
    typeof service.launchPriceMinor === 'number' &&
    typeof service.regularPriceMinor === 'number' &&
    service.regularPriceMinor > service.launchPriceMinor;

  const bundleParts = (service.bundleComponents || [])
    .map((code) => findServiceBySku(code))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="bg-brand-ivory text-brand-ink">
      {/* Dark Luxury Breadcrumb & Title Header */}
      <section className="border-b border-brand-gold/25 bg-brand-forest py-12 text-brand-platinum">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-softgold hover:text-brand-ivory"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Service Catalog</span>
          </Link>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-emerald">
            {service.sku}
            {department ? ` · ${department.code}. ${department.name}` : ''}
            {service.deliveryTarget ? ` · ${service.deliveryTarget}` : ''}
          </p>

          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-ivory sm:text-5xl">
            {service.name}
          </h1>
          <p className="mt-2 font-bengali text-base text-brand-softgold/90">{service.nameBn}</p>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-brand-platinum/85 sm:text-base">
            {service.shortDescription}
          </p>
          <p className="mt-2 max-w-3xl font-bengali text-sm leading-relaxed text-brand-platinum/75">
            {service.shortDescriptionBn}
          </p>
        </div>
      </section>

      {/* Main Content + Commercial Summary Sidebar */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Detailed Scope & Deliverables */}
          <div className="space-y-6 lg:col-span-8">
            {/* Official Scope & Deliverable Brief */}
            {(service.scopeEn || service.deliverableEn) && (
              <div className="border border-brand-hairline bg-white p-6">
                <h2 className="font-serif text-xl font-semibold text-brand-forest">
                  Official Scope & Tangible Deliverables
                </h2>
                {service.scopeEn && (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-emerald">
                      Scope Definition
                    </p>
                    <p className="mt-1 text-sm text-brand-ink">{service.scopeEn}</p>
                    {service.scopeBn && (
                      <p className="mt-1 font-bengali text-xs text-brand-muted">{service.scopeBn}</p>
                    )}
                  </div>
                )}
                {service.deliverableEn && (
                  <div className="mt-4 border-t border-brand-hairline pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-emerald">
                      Expected Handover / Deliverable
                    </p>
                    <p className="mt-1 text-sm text-brand-ink">{service.deliverableEn}</p>
                    {service.deliverableBn && (
                      <p className="mt-1 font-bengali text-xs text-brand-muted">
                        {service.deliverableBn}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bundle Component Breakdown */}
            {bundleParts.length > 0 && (
              <div className="border border-brand-gold/40 bg-white p-6">
                <h2 className="font-serif text-xl font-semibold text-brand-forest">
                  Included Bundle Components (Deduplicated Automatically)
                </h2>
                <p className="mt-1 text-xs text-brand-muted">
                  Selecting {service.sku} automatically suppresses separate charges for these included services.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {bundleParts.map((part) => (
                    <Link
                      key={part.sku}
                      href={`/services/${part.slug}`}
                      className="border border-brand-hairline bg-brand-ivory/40 p-3.5 hover:border-brand-gold"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-emerald">
                        {part.sku}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-brand-forest">{part.name}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Inclusions */}
            <div className="border border-brand-hairline bg-white p-6">
              <h2 className="font-serif text-xl font-semibold text-brand-forest">
                What Is Included
              </h2>
              <ul className="mt-4 space-y-2.5 text-sm text-brand-ink">
                {service.inclusions.map((inc, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald" />
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Exclusions */}
            <div className="border border-brand-hairline bg-white p-6">
              <h2 className="font-serif text-xl font-semibold text-brand-forest">
                Explicit Exclusions & Boundaries
              </h2>
              <ul className="mt-4 space-y-2.5 text-sm text-brand-muted">
                {service.exclusions.map((exc, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <span>{exc}</span>
                  </li>
                ))}
              </ul>
              {service.exclusionsBn && service.exclusionsBn.length > 0 && (
                <p className="mt-3 border-t border-brand-hairline pt-3 font-bengali text-xs text-brand-muted">
                  {service.exclusionsBn.join(' ')}
                </p>
              )}
            </div>

            {/* Prerequisites */}
            {service.prerequisites.length > 0 && (
              <div className="border border-brand-hairline bg-white p-6">
                <h2 className="font-serif text-xl font-semibold text-brand-forest">
                  Client Prerequisites
                </h2>
                <ul className="mt-4 space-y-2 text-sm text-brand-ink">
                  {service.prerequisites.map((pre, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                      <span>{pre}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Commercial Card */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 border border-brand-gold/35 bg-brand-forest p-6 text-brand-platinum shadow-forest-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-softgold">
                {pricingWindow.isLaunchActive ? '2026 Launch Offer Active' : 'Standard List Rate'}
              </p>

              <p className="tabular-price mt-3 text-4xl font-bold text-brand-ivory">
                {service.isFromPrice ? 'From ' : ''}
                {formatBdt(effectiveMinor)}
                {service.billingPeriod === 'monthly' && (
                  <span className="text-sm font-normal text-brand-platinum/75">/month</span>
                )}
              </p>

              {showLaunchContrast && (
                <p className="tabular-price mt-1.5 text-xs text-brand-platinum/75">
                  Planned Standard List Rate: {formatBdt(regularMinor)}
                  {service.billingPeriod === 'monthly' ? '/month' : ''}
                </p>
              )}

              {service.allowance && (
                <div className="mt-4 border-t border-brand-teal pt-4 text-xs text-brand-softgold">
                  <p className="uppercase tracking-wider text-brand-platinum/65">Tier Allowance</p>
                  <p className="mt-1 font-medium text-brand-ivory">{service.allowance}</p>
                </div>
              )}

              <dl className="mt-5 space-y-2.5 border-y border-brand-teal py-4 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-platinum/70">Catalog Code</dt>
                  <dd className="font-semibold text-brand-ivory">{service.sku}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-platinum/70">Billing Mode</dt>
                  <dd className="font-semibold capitalize text-brand-ivory">
                    {service.billingPeriod.replace('_', ' ')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-platinum/70">Target Turnaround</dt>
                  <dd className="font-semibold text-brand-ivory">{service.deliveryTarget}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-platinum/70">Pricing Baseline</dt>
                  <dd className="font-semibold text-brand-ivory">{BRAND_V3.pricingBaseline}</dd>
                </div>
              </dl>

              {service.offerPolicy && (
                <p className="mt-4 text-xs leading-relaxed text-brand-softgold/95">
                  {service.offerPolicy}
                </p>
              )}

              {service.checkoutEnabled ? (
                <Link
                  href={`/build?sku=${encodeURIComponent(service.sku)}`}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-brand-gold py-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-forest hover:bg-brand-softgold"
                >
                  <span>Configure & Price Now</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href="/audit"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 border border-brand-gold/45 py-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-ivory hover:border-brand-gold"
                >
                  <span>Request Scoped Consultation</span>
                </Link>
              )}

              <p className="mt-4 text-[11px] leading-relaxed text-brand-platinum/65">
                {BRAND_V3.commercialWindow.standardNoteEn}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
