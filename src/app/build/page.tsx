import React, { Suspense } from 'react';
import { ConfiguratorWizard } from '@/components/configurator/ConfiguratorWizard';
import { getActivePricingWindow } from '@/domain/catalog';

export default function BuildPackagePage() {
  const pricingWindow = getActivePricingWindow();

  return (
    <div className="bg-brand-ivory text-brand-ink">
      <section className="border-b border-brand-gold/25 bg-brand-forest py-12 text-brand-platinum">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
            {pricingWindow.labelEn}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-ivory sm:text-5xl">
            Interactive Package Builder & Quote Engine
          </h1>
          <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-brand-platinum/80 sm:text-base">
            Configure across all 6 departments, 3 signature bundles, HOOOPLAAA VA+ tiers, and 22
            specialist add-ons. Eligibility, bundle deduplication, and BDT totals are validated
            server-side.
          </p>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-brand-muted">
            Loading package configurator...
          </div>
        }
      >
        <ConfiguratorWizard />
      </Suspense>
    </div>
  );
}
