import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8 text-slate-800 text-xs sm:text-sm leading-relaxed">
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
          Legal & Compliance
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-1">Privacy & Data Handling Policy</h1>
        <p className="text-xs text-slate-500 mt-1">Effective Date: 2026-11-08 • Hoooplaaa Incorporated</p>
      </div>

      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">1. Data Collection & Purpose</h2>
          <p>
            Hoooplaaa Incorporated collects only the minimal business and contact data required to
            deliver digital infrastructure and marketing services: business name, contact email, WhatsApp
            phone number, target audience brief, and public asset URLs.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">2. Zero Password Storage</h2>
          <p>
            We never request, accept, or store customer passwords. All onboarding processes use delegated
            OAuth or platform partner access.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">3. Private Storage & Asset Protection</h2>
          <p>
            Client logos, cover images, and business briefs uploaded through our workspace are stored in
            private, encrypted object storage. Files are accessible solely by authorized project team
            members and the verified client via time-limited signed URLs.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">4. Retention and Right to Deletion</h2>
          <p>
            Clients may request full deletion of uploaded assets and personal contact records following
            handover acceptance by contacting support@hoooplaaa.com. Audit logs required for legal,
            tax, and financial reconciliation are preserved in an append-only format.
          </p>
        </section>
      </div>
    </div>
  );
}
