import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CANONICAL_SERVICES } from '@/domain/catalog';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
  ChevronLeft,
  Lock,
} from 'lucide-react';

export function generateStaticParams() {
  return CANONICAL_SERVICES.map((srv) => ({
    slug: srv.slug,
  }));
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const srv = CANONICAL_SERVICES.find((s) => s.slug === slug);

  if (!srv) {
    notFound();
  }

  const isCheckoutReady = srv.checkoutEnabled && srv.publicationStatus === 'published';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/services"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Back to All Services</span>
        </Link>
      </div>

      {/* Hero Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
              {srv.sku}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Target: {srv.deliveryTarget}
            </span>
          </div>

          <div className="text-right">
            <div className="text-3xl font-extrabold text-slate-900">
              ৳{(srv.basePriceMinor / 100).toLocaleString('en-US')}
            </div>
            <div className="text-xs text-slate-500">
              {srv.billingPeriod === 'weekly' ? 'per week' : 'one-time setup fee'}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">{srv.name}</h1>
          <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
            {srv.shortDescription}
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4">
          {isCheckoutReady ? (
            <Link
              href={`/build?sku=${srv.sku}`}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-hoooplaaa-gold-500 to-hoooplaaa-gold-600 hover:from-hoooplaaa-gold-400 hover:to-hoooplaaa-gold-500 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider shadow-gold-glow flex items-center gap-2 transition"
            >
              <span>Configure This Service</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <span className="px-4 py-2.5 rounded-xl bg-amber-100 text-amber-900 font-semibold text-xs flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              Proposed Service — Deployment Evaluation Required
            </span>
          )}
          <Link
            href="/audit"
            className="px-5 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Check Business Eligibility First
          </Link>
        </div>
      </div>

      {/* Scope Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Inclusions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm uppercase tracking-wider">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>What Is Included</span>
          </div>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
            {srv.inclusions.map((inc, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{inc}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Exclusions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm uppercase tracking-wider">
            <XCircle className="w-5 h-5 text-rose-600" />
            <span>Explicit Exclusions</span>
          </div>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
            {srv.exclusions.map((exc, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{exc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Prerequisites & Security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Client Prerequisites</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            To ensure swift fulfillment within our SLA delivery target, clients must prepare the
            following prior to intake:
          </p>
          <ul className="space-y-2 text-xs text-slate-700">
            {srv.prerequisites.map((pre, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>{pre}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-hoooplaaa-gold-400">
            <ShieldCheck className="w-5 h-5" />
            <span>Zero Password Security Guarantee</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Hoooplaaa Incorporated never asks for your personal account passwords. We utilize official
            delegated partner invitations (Meta Business Partner delegation, Google Business Profile
            manager invitation, and LinkedIn Page administrator access). You retain 100% legal asset
            ownership at all times.
          </p>
        </div>
      </div>
    </div>
  );
}
