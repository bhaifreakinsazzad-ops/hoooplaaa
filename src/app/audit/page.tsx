'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileSearch,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Send,
  Loader2,
  Globe,
  Clock,
} from 'lucide-react';

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
      : 'Analyze missing foundations on Facebook & Google'
  );
  const [loading, setLoading] = useState(false);
  const [submittedAuditId, setSubmittedAuditId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
    } catch (err: any) {
      alert(err.message || 'Error submitting audit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
          <FileSearch className="w-3.5 h-3.5" />
          <span>Complimentary Public Analysis</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
          Free Initial Business Readiness Audit
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          We inspect your public Facebook, Google, and website presence to identify missing
          infrastructure, security gaps, and conversion bottlenecks.
        </p>
      </div>

      {submittedAuditId ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
            Audit Ref: {submittedAuditId}
          </span>
          <h2 className="text-2xl font-bold text-slate-900">Audit Request Received!</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Our strategist will inspect your public digital assets ({url}) within 24–48 hours. A
            summary finding with recommended setup solutions will be sent to <strong>{email}</strong>.
          </p>
          <div className="pt-2">
            <a
              href="/build"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider"
            >
              <span>Explore 3-Platform Bundle</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-6">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero-Password, Public-Only Inspection</span>
            </div>
            <p>
              This free initial review evaluates only publicly available profiles. We never ask for
              your passwords or internal analytics tokens.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business / Brand Name *
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Bengal Leather Crafts"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Facebook Page or Website URL *
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://facebook.com/yourpage or https://yourbrand.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900 font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address (Where findings will be sent) *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp / Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Question or Growth Challenge
              </label>
              <textarea
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-hoooplaaa-gold-500 text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Request Complimentary Audit</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs">Loading audit page...</div>}>
      <AuditFormContent />
    </Suspense>
  );
}
