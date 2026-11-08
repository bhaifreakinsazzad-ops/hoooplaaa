import React from 'react';

export default function RefundPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8 text-slate-800 text-xs sm:text-sm leading-relaxed">
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
          Legal & Compliance
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-1">Refund & Scope Adjustment Policy</h1>
        <p className="text-xs text-slate-500 mt-1">Effective Date: 2026-11-08 • Hoooplaaa Incorporated</p>
      </div>

      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">1. Pre-Fulfillment Cancellation</h2>
          <p>
            If a client cancels an order before our specialists begin setup work (i.e. while status
            remains in <em>&apos;awaiting_requirements&apos;</em>), a 100% full refund is issued back to the
            original payment channel (subject to provider processing deductions where applicable).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">2. Platform Ineligibility Adjustment</h2>
          <p>
            In the event that a client purchases a 3-Platform Bundle and their business is subsequently
            determined by official platform guidelines to be ineligible for Google Business Profile (e.g.
            dropshipping or virtual offices with no in-person contact), Hoooplaaa will either: (a) re-scope
            the order to alternative digital assets of equal value, or (b) issue a partial refund for the
            unfulfilled component.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">3. Completed Deliverables & Included Revisions</h2>
          <p>
            Because digital setup work involves dedicated specialist hours and asset deployment, full
            refunds cannot be issued once deliverables have been configured and handed over. However, all
            services include 1 formal revision cycle to correct any discrepancy against agreed scope.
          </p>
        </section>
      </div>
    </div>
  );
}
