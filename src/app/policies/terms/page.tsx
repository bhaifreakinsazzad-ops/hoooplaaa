import React from 'react';
import { BRAND_V3 } from '@/domain/brand-v3';

export default function TermsPage() {
  return (
    <div className="bg-brand-ivory text-brand-ink">
      <section className="border-b border-brand-gold/25 bg-brand-forest py-12 text-brand-platinum">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
            Legal & Commercial Governance · {BRAND_V3.pricingBaseline}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-ivory sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-1.5 text-xs text-brand-platinum/75">
            Effective Date: 2026-11-21 · {BRAND_V3.legalName} ({BRAND_V3.contact.timezone})
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 text-sm leading-relaxed sm:px-6 lg:px-8">
        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            1. Scope of HOOOPLAAA-Owned Services & Partner Boundaries
          </h2>
          <p className="text-brand-muted">
            {BRAND_V3.legalName} delivers specialist-led services across six approved departments:
            Business Setup &amp; Digital Presence, Digital Advertising &amp; Marketing, HOOOPLAAA VA+
            Managed Support, Leads, CRM &amp; Conversion, Audience Intelligence &amp; Growth, and
            Marketing Tracking &amp; Analytics. Independent partner capabilities—graphic/video
            creative production (Freakin’s Studio), custom software/AI engineering (NotRealEngine),
            and SaaS licensing (How To Keep It Simple / HTKIS)—are scoped separately outside
            HOOOPLAAA self-checkout.
          </p>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            2. 2026 Launch Offer Window &amp; Monthly Renewal Consent
          </h2>
          <p className="text-brand-muted">
            Published 2026 Launch Offer rates apply automatically from 20 November 2026 through 31
            December 2026 (Asia/Dhaka timezone). Planned Standard List Rates apply automatically
            outside that window and do not represent historical sale price claims. For monthly
            services (HOOOPLAAA VA+ tiers and Ongoing Campaign Management), the 2026 Launch Offer
            applies strictly to Month 1 only; renewal from Month 2 occurs at the published Standard
            List Rate only with explicit client renewal consent.
          </p>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            3. Evidence-Based Delivery — No Unsupported Outcome Guarantees
          </h2>
          <p className="text-brand-muted">
            {BRAND_V3.promise} Client acknowledges that {BRAND_V3.legalName} does not warrant
            guaranteed Google Search/Maps rankings, guaranteed Google or Meta account verification
            approvals, guaranteed closed sales, or guaranteed ROAS. Third-party platform policies
            and algorithms are controlled exclusively by their respective operators.
          </p>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            4. Separation of Paid Media Budgets &amp; Third-Party Fees
          </h2>
          <p className="text-brand-muted">
            All BDT catalog rates represent HOOOPLAAA professional service fees. Paid advertising
            budgets (Meta, Google, LinkedIn), third-party CRM or SaaS licenses, domain/hosting
            costs, and platform messaging charges are wholly separate and paid directly by the
            client.
          </p>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            5. Delegated Access, Client Ownership &amp; Lawful Lead Use
          </h2>
          <p className="text-brand-muted">
            We strictly prohibit raw password collection; onboarding uses official partner
            delegation. Clients retain 100% ownership of all business portfolios, pages, and
            analytics properties. For Leads &amp; CRM services (L01/L02), only lawful sources and
            permissible business contact fields are used, and clients must adhere to lawful outreach
            practices.
          </p>
        </section>
      </div>
    </div>
  );
}
