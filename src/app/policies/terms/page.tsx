import React from 'react';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8 text-slate-800 text-xs sm:text-sm leading-relaxed">
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
          Legal & Compliance
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-1">Terms of Service</h1>
        <p className="text-xs text-slate-500 mt-1">Effective Date: 2026-11-08 • Hoooplaaa Incorporated</p>
      </div>

      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">1. Nature of Services</h2>
          <p>
            Hoooplaaa Incorporated provides digital setup, infrastructure configuration, tracking
            integration, and digital marketing consulting services. Our setup solutions operate on a
            done-for-you professional setup model governed by explicit line-item inclusions and
            exclusions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">2. No Guaranteed Rankings or Revenue Claims</h2>
          <p>
            Client explicitly acknowledges that Hoooplaaa Incorporated does not make or warrant any
            claims of guaranteed Google 1st-page search rankings, guaranteed Meta/Google advertisement
            approvals, or guaranteed return on ad spend (ROAS). Platform approvals and ranking algorithms
            are controlled exclusively by third-party providers (Google LLC, Meta Platforms, Inc.,
            LinkedIn Corporation).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">3. Separation of Ad Budget and Third-Party Fees</h2>
          <p>
            All setup prices (e.g. Meta Business Setup ৳1,500, Google Profile Setup ৳1,500, LinkedIn Setup
            ৳1,500, 3-Platform Bundle ৳3,000, WhatsApp Automation ৳1,690, Meta Pixel ৳1,500, Static Creative ৳990)
            represent professional agency service fees. Platform advertising budgets, third-party messaging
            credits (such as Meta WhatsApp Cloud API conversation fees), and domain/hosting charges are
            wholly separate and paid directly by the client to the respective providers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">4. Password Security and Delegated Access</h2>
          <p>
            To protect client security, Hoooplaaa Incorporated strictly prohibits the collection of raw
            passwords. Clients must authorize our agency specialists using official partner invitation
            mechanisms (Meta Business Partner delegation, Google Profile manager invitations, LinkedIn Page
            admin rights). The client retains 100% legal ownership of their business assets at all times.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">5. SLA Delivery Clock</h2>
          <p>
            Contractual delivery turnaround times (e.g. 2–4 business days for bundles) commence only after:
            (a) invoice payment has been verified by our gateway or finance ledger, AND (b) the client has
            fully submitted required onboarding intake materials and delegated necessary partner access.
          </p>
        </section>
      </div>
    </div>
  );
}
