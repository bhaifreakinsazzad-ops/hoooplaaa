import React from 'react';
import { BRAND_V3 } from '@/domain/brand-v3';

export default function DeliveryPolicyPage() {
  return (
    <div className="bg-brand-ivory text-brand-ink">
      <section className="border-b border-brand-gold/25 bg-brand-forest py-12 text-brand-platinum">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
            Legal & Operational Governance · {BRAND_V3.contact.timezone}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-ivory sm:text-4xl">
            Delivery &amp; SLA Policy
          </h1>
          <p className="mt-1.5 text-xs text-brand-platinum/75">
            Effective Date: 2026-11-21 · {BRAND_V3.legalName}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 text-sm leading-relaxed sm:px-6 lg:px-8">
        <section className="border border-brand-hairline bg-white p-6 space-y-3">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            1. Standard Turnaround Targets (Business Days · Asia/Dhaka)
          </h2>
          <ul className="space-y-1.5 list-disc list-inside text-brand-muted">
            <li>B01 Meta Business Setup / B02 Google Business Profile Setup: 1–2 business days</li>
            <li>B03 LinkedIn Business Setup: 1 business day · B04 Professional Business Audit: 2 business days</li>
            <li>PK01 Complete 3-Platform Business Setup: 2–4 business days</li>
            <li>PK02 Growth Intelligence Package: 5 business days · PK03 Tracking Essentials: 2 business days</li>
            <li>T01–T05 Marketing Tracking &amp; Analytics: 1–3 business days depending on scope</li>
            <li>L01–L04 Leads, CRM &amp; Conversion: 2–5 business days depending on agreed criteria</li>
            <li>HOOOPLAAA VA+ &amp; Ongoing Campaign Management: Monthly operational cycle (2-day onboarding)</li>
          </ul>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            2. Contractual SLA Clock Commencement
          </h2>
          <p className="text-brand-muted">
            The delivery SLA clock begins strictly when both prerequisites are satisfied: (1)
            payment verification is recorded in the financial ledger, and (2) all mandatory
            onboarding intake inputs and delegated platform access invitations have been supplied by
            the client.
          </p>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            3. QA Signoff &amp; Handover Acceptance
          </h2>
          <p className="text-brand-muted">
            Every deliverable undergoes internal specialist QA verification against your immutable
            quote snapshot before posting to the Client Workspace. Clients have 7 calendar days to
            inspect handover links and request an included scope-aligned revision.
          </p>
        </section>
      </div>
    </div>
  );
}
