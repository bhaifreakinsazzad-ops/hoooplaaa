import React from 'react';
import { BRAND_V3 } from '@/domain/brand-v3';

export default function PrivacyPage() {
  return (
    <div className="bg-brand-ivory text-brand-ink">
      <section className="border-b border-brand-gold/25 bg-brand-forest py-12 text-brand-platinum">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
            Legal & Data Governance
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-ivory sm:text-4xl">
            Privacy &amp; Data Handling Policy
          </h1>
          <p className="mt-1.5 text-xs text-brand-platinum/75">
            Effective Date: 2026-11-21 · {BRAND_V3.legalName}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 text-sm leading-relaxed sm:px-6 lg:px-8">
        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            1. Minimal Data Collection &amp; Lawful Lead Governance
          </h2>
          <p className="text-brand-muted">
            {BRAND_V3.legalName} collects only the business and contact information required to
            deliver ordered services—business name, contact email, WhatsApp number, brand brief, and
            public profile URLs. Lead supply services strictly exclude unlicensed personal data and
            unauthorized scraping.
          </p>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            2. Zero Password Storage
          </h2>
          <p className="text-brand-muted">
            We never request, accept, or store personal or corporate account passwords. Platform
            onboarding relies strictly on official delegated partner invitations and role-based
            permissions.
          </p>
        </section>

        <section className="border border-brand-hairline bg-white p-6 space-y-2">
          <h2 className="font-serif text-lg font-semibold text-brand-forest">
            3. Private Storage, Access Control &amp; Deletion Rights
          </h2>
          <p className="text-brand-muted">
            Uploaded brand assets and deliverables are isolated per customer organization and served
            only via authorized workspace sessions. Clients may request deletion of uploaded assets
            and contact records after handover by emailing {BRAND_V3.contact.email}. Immutable audit
            trails required for financial reconciliation are retained strictly for compliance.
          </p>
        </section>
      </div>
    </div>
  );
}
