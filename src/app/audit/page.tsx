'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Send, ShieldCheck } from 'lucide-react';

function AuditFormContent() {
  const searchParams = useSearchParams();
  const initialReason = searchParams.get('reason') || '';

  const [businessName, setBusinessName] = useState('');
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState(
    initialReason
      ? `Scope Consultation: ${initialReason}`
      : 'Review digital presence, tracking readiness, and recommended department priorities'
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedAuditId, setSubmittedAuditId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          websiteOrPageUrl: url,
          contactEmail: email,
          contactPhone: phone,
          primaryGoal,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit audit application.');

      setSubmittedAuditId(data.audit.id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error submitting audit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-brand-ivory text-brand-ink">
      <section className="border-b border-brand-gold/25 bg-brand-forest py-14 text-brand-platinum">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
            Complimentary Pre-Sale Assessment
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-ivory sm:text-5xl">
            Free Initial Business Readiness Audit
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-platinum/80 sm:text-base">
            We inspect your public digital profiles and inquiry path to identify structural gaps,
            eligibility requirements, and the clearest starting scope—without asking for passwords.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {submittedAuditId ? (
          <div className="border border-brand-hairline bg-white p-8 text-center space-y-4 sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center bg-brand-forest text-brand-gold">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand-emerald">
              Audit Reference: {submittedAuditId}
            </p>
            <h2 className="font-serif text-2xl font-semibold text-brand-forest">
              Audit Request Received
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-brand-muted">
              A strategist will review your public digital assets ({url}) within 24–48 business
              hours and deliver structured written recommendations to{' '}
              <strong className="text-brand-forest">{email}</strong>.
            </p>
            <div className="pt-3 flex flex-wrap justify-center gap-3">
              <Link
                href="/build?preset=PK01"
                className="inline-flex items-center gap-2 bg-brand-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-forest hover:bg-brand-softgold"
              >
                <span>Configure PK01 Bundle</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 border border-brand-forest/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-brand-forest hover:bg-brand-ivory"
              >
                <span>Browse All 57 Services</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="border border-brand-hairline bg-white p-7 sm:p-10 space-y-6">
            <div className="flex items-start gap-3 border border-brand-hairline bg-brand-ivory/60 p-4 text-xs text-brand-ink">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald" />
              <div>
                <p className="font-semibold text-brand-forest">Zero-Password Public Inspection</p>
                <p className="mt-1 text-brand-muted">
                  This complimentary review evaluates only publicly accessible profiles and links.
                  Need a deeper diagnostic? See{' '}
                  <Link href="/services/b04-professional-business-audit" className="underline text-brand-forest">
                    B04 — Professional Business Audit (৳1,490 Launch)
                  </Link>
                  .
                </p>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 border border-amber-700/40 bg-amber-50 p-3.5 text-xs text-amber-950"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-forest">
                  Business / Brand Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g., Bengal Heritage Crafts"
                  className="w-full border border-brand-hairline bg-brand-ivory/40 px-4 py-2.5 text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-forest">
                  Primary Facebook Page or Website URL *
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://facebook.com/yourpage or https://yourbrand.com"
                  className="w-full border border-brand-hairline bg-brand-ivory/40 px-4 py-2.5 font-mono text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-forest">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full border border-brand-hairline bg-brand-ivory/40 px-4 py-2.5 text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-forest">
                    WhatsApp / Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1XXX-XXXXXX"
                    className="w-full border border-brand-hairline bg-brand-ivory/40 px-4 py-2.5 text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-forest">
                  Primary Question or Growth Objective
                </label>
                <textarea
                  value={primaryGoal}
                  onChange={(e) => setPrimaryGoal(e.target.value)}
                  rows={3}
                  className="w-full border border-brand-hairline bg-brand-ivory/40 px-4 py-2.5 text-sm text-brand-forest focus:border-brand-forest focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 bg-brand-forest py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-brand-ivory transition-colors hover:bg-brand-teal disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 text-brand-gold" />
                    <span>Request Complimentary Audit</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-brand-muted">Loading audit request form...</div>
      }
    >
      <AuditFormContent />
    </Suspense>
  );
}
