import React from 'react';
import { BRAND_V3 } from '@/domain/brand-v3';

export default function RefundPage() {
  return (
    <div className="bg-brand-ivory text-brand-ink">
      <section className="border-b border-brand-gold/25 bg-brand-forest py-12 text-brand-platinum">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
            Legal & Commercial Governance
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-ivory sm:text-4xl">
            Refund &amp; Scope Adjustment Policy
          </h1>
          <p className="mt-1.5 text-xs text-brand-platinum/75">
            Effective Date: 2026-11-21 · {BRAND_V3.legalName}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 text-sm leading-relaxed sm:px-6 lg:px-8">
        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            1. Pre-Fulfillment Cancellation
          </h2>
          <p className="text-brand-muted">
            If an order is cancelled before specialist fulfillment begins (while status remains in{' '}
            <em>awaiting_requirements</em>), a 100% refund is issued to the original payment
            channel, less non-refundable gateway processing deductions where applicable.
          </p>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            2. Platform Eligibility &amp; Scope Adjustment
          </h2>
          <p className="text-brand-muted">
            If an order includes Google Business Profile (B02/PK01) or tracking integration
            (T01–T03/PK03) and the client’s platform is subsequently determined ineligible under
            third-party rules, HOOOPLAAA will either re-scope the order to eligible services of
            equal value or refund the unfulfilled line-item portion.
          </p>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            3. Completed Deliverables, Monthly Plans &amp; Revisions
          </h2>
          <p className="text-brand-muted">
            Completed one-time deliverables and active monthly service cycles (HOOOPLAAA VA+ and
            Ongoing Campaign Management) are non-refundable once specialist hours have been
            executed, but every one-time deliverable includes a formal revision cycle to address any
            deviation from the signed quote snapshot. Monthly plans never auto-renew without client
            consent.
          </p>
        </section>
      </div>
    </div>
  );
}
