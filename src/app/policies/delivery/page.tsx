import React from 'react';

export default function DeliveryPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8 text-slate-800 text-xs sm:text-sm leading-relaxed">
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
          Legal & Compliance
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-1">Delivery & SLA Policy</h1>
        <p className="text-xs text-slate-500 mt-1">Effective Date: 2026-11-08 • Hoooplaaa Incorporated</p>
      </div>

      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">1. Standard Delivery Targets</h2>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>Meta Business Setup: 1–2 business days</li>
            <li>Google Business Profile Setup: 1–2 business days (submission & optimization)</li>
            <li>LinkedIn Company Page Setup: 1 business day</li>
            <li>Complete 3-Platform Business Setup: 2–4 business days</li>
            <li>WhatsApp Automation Setup: 2 business days</li>
            <li>Meta Pixel Tracking Setup: 1–2 business days</li>
            <li>Professional Ad Creative (Basic Static): 1–2 business days</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">2. Contractual Clock Commencement</h2>
          <p>
            The delivery SLA clock begins strictly when both of the following prerequisites are met:
            (1) payment verification is confirmed, and (2) all mandatory onboarding intake fields and
            delegated permissions have been supplied by the client.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">3. Handover Protocol & Acceptance</h2>
          <p>
            Upon completion and internal QA signoff, handover links and documentation are posted to the
            Client Workspace. The client has 7 calendar days to review deliverables and request included
            revisions. If no feedback is submitted within 7 days, the order is automatically marked as
            Accepted and closed.
          </p>
        </section>
      </div>
    </div>
  );
}
