import React from 'react';
import Link from 'next/link';
import { BRAND_V3 } from '@/domain/brand-v3';
import { ArrowRight } from 'lucide-react';

const WORKFLOW_STEPS = [
  {
    num: '01',
    title: 'Configure Scope & Verify Eligibility',
    tag: 'Instant Server-Side Guardrails',
    body: 'Select from 6 approved departments, 3 signature bundles, HOOOPLAAA VA+ tiers, and 22 specialist add-ons. Answer concise operational questions so our engine checks Google Business Profile, Meta account standing, and website CMS prerequisites before checkout.',
    highlightTitle: 'Proactive Eligibility Protection',
    highlight:
      'Pure online-only businesses without in-person customer visits are informed upfront before spending a single Taka on Google Business Profile, and offered eligible alternatives such as B01 + B03.',
  },
  {
    num: '02',
    title: 'Authoritative BDT Quote Snapshot',
    tag: 'Pricing Revision 4.4 · Asia/Dhaka Window',
    body: 'Our server calculates every quote in integer minor units (Poisha), automatically applying 2026 Launch Prices during 20 Nov–31 Dec 2026 (Asia/Dhaka) and transitioning cleanly to Planned Standard List Rates afterward.',
    highlightTitle: 'Automatic Deduplication & Zero Double Billing',
    highlight:
      'Bundles (PK01, PK02, PK03) automatically suppress charges for included individual services, and alias ledger rows (such as X05 vs A01-MODE-2) can never be double-billed. Every quote is locked with an immutable SHA-256 terms hash.',
  },
  {
    num: '03',
    title: 'Verified Payment & Ledger Reconciliation',
    tag: 'SSLCOMMERZ & Manual MFS Finance Verification',
    body: 'Complete checkout via SSLCOMMERZ or verified manual bKash/Nagad reference. Idempotency keys and replay protection prevent duplicate orders or double charges.',
    highlightTitle: 'Strict Financial Integrity',
    highlight:
      'Orders never advance on unverified browser redirects alone. Only authenticated server-to-server payment callbacks or verified finance ledger signoff unlock fulfillment.',
  },
  {
    num: '04',
    title: 'Passwordless Intake, QA & Asset Handover',
    tag: '100% Client Asset Ownership',
    body: 'Submit your onboarding brief inside the Client Workspace using official partner delegation invitations—HOOOPLAAA never collects or stores personal account passwords.',
    highlightTitle: 'Business-Day SLA Clock',
    highlight:
      'Delivery SLA timelines (Asia/Dhaka business calendar) begin only after verified payment AND completed intake. Every deliverable passes internal QA review before handover acceptance.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-brand-ivory text-brand-ink">
      <section className="border-b border-brand-gold/25 bg-brand-forest py-14 text-brand-platinum">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
            {BRAND_V3.philosophy} · Brand Book v{BRAND_V3.version}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-ivory sm:text-5xl">
            How Self-Service Agency Commerce Works
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-platinum/80 sm:text-base">
            No opaque retainers, no mandatory discovery calls, and zero password sharing.{' '}
            {BRAND_V3.legalName} delivers specialist-led digital infrastructure and growth operations
            through four transparent stages.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-6 px-4 py-14 sm:px-6 lg:px-8">
        {WORKFLOW_STEPS.map((step) => (
          <div
            key={step.num}
            className="grid grid-cols-1 gap-8 border border-brand-hairline bg-white p-7 sm:p-9 md:grid-cols-12"
          >
            <div className="md:col-span-4 space-y-2">
              <span className="inline-flex h-11 w-11 items-center justify-center bg-brand-forest font-serif text-lg font-semibold text-brand-gold">
                {step.num}
              </span>
              <h2 className="font-serif text-xl font-semibold text-brand-forest">{step.title}</h2>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-emerald">
                {step.tag}
              </p>
            </div>
            <div className="md:col-span-8 space-y-4 text-sm leading-relaxed text-brand-muted">
              <p>{step.body}</p>
              <div className="border border-brand-hairline bg-brand-ivory/60 p-4 text-xs text-brand-ink">
                <p className="font-semibold uppercase tracking-wider text-brand-forest">
                  {step.highlightTitle}
                </p>
                <p className="mt-1 leading-relaxed text-brand-muted">{step.highlight}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Bottom CTA */}
        <div className="mt-12 flex flex-col items-start justify-between gap-6 border border-brand-gold/40 bg-brand-forest p-8 text-brand-ivory sm:flex-row sm:items-center sm:p-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-softgold">
              {BRAND_V3.supportingLine}
            </p>
            <h2 className="mt-1.5 font-serif text-2xl font-semibold sm:text-3xl">
              Ready to configure your growth package?
            </h2>
          </div>
          <Link
            href="/build"
            className="inline-flex shrink-0 items-center gap-2 bg-brand-gold px-7 py-3.5 text-xs font-bold uppercase tracking-[0.15em] text-brand-forest hover:bg-brand-softgold"
          >
            <span>Open Package Builder</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
