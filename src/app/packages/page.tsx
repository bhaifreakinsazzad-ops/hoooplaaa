import React from 'react';
import Link from 'next/link';
import { CANONICAL_SERVICES } from '@/domain/catalog';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  Clock,
  Layers,
} from 'lucide-react';

export default function PackagesPage() {
  const bundle = CANONICAL_SERVICES.find((s) => s.sku === 'HI-BUNDLE-3')!;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-hoooplaaa-gold-600">
          Approved Business Bundles
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
          Complete Multi-Platform Foundation
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Consolidate your digital presence across social, search, and professional networks under one
          coherent visual identity.
        </p>
      </div>

      {/* Hero Bundle Showcase */}
      <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-b from-hoooplaaa-navy-950 to-hoooplaaa-navy-900 text-white p-8 sm:p-12 border-2 border-hoooplaaa-gold-500/50 shadow-2xl relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-hoooplaaa-navy-800">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-hoooplaaa-gold-500 text-hoooplaaa-navy-950 text-xs font-black uppercase tracking-widest inline-block">
              Core Hero Offer
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{bundle.name}</h2>
            <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
              {bundle.shortDescription}
            </p>
          </div>

          <div className="text-left md:text-right shrink-0">
            <div className="text-4xl font-black text-white">৳3,000</div>
            <div className="text-xs text-slate-400 line-through">Separate: ৳4,500</div>
            <div className="text-xs font-bold text-emerald-400">Save ৳1,500 (33⅓%)</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 md:justify-end">
              <Clock className="w-3.5 h-3.5" />
              <span>SLA: 2–4 Business Days</span>
            </div>
          </div>
        </div>

        {/* Breakdown of what's inside */}
        <div className="py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl bg-hoooplaaa-navy-900/90 border border-hoooplaaa-navy-800 space-y-2">
            <div className="font-bold text-sm text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Meta Infrastructure
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Business Portfolio, Facebook Page optimization, Instagram linking, and delegated
              handover.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-hoooplaaa-navy-900/90 border border-hoooplaaa-navy-800 space-y-2">
            <div className="font-bold text-sm text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Google Business Profile
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Physical shop or local service-area setup with category hierarchy & verification
              guidance.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-hoooplaaa-navy-900/90 border border-hoooplaaa-navy-800 space-y-2">
            <div className="font-bold text-sm text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              LinkedIn Company Page
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Corporate Page, branded banner, headline, about narrative, and admin delegation.
            </p>
          </div>
        </div>

        {/* Eligibility Guard */}
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3 mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Google Policy Compliance Check:</strong>
            <span>
              Businesses operating strictly online without in-person customer visits are ineligible
              for Google Business Profile. Our configurator automatically checks your business type
              and will guide you to alternative packages before checkout.
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-hoooplaaa-navy-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-hoooplaaa-gold-400" />
            <span>Includes Complimentary Post-Sale Detailed Business Audit</span>
          </div>

          <Link
            href="/build?preset=bundle"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-hoooplaaa-gold-500 hover:bg-hoooplaaa-gold-400 text-hoooplaaa-navy-950 font-bold text-xs uppercase tracking-wider text-center shadow-gold-glow transition flex items-center justify-center gap-2"
          >
            <span>Start 3-Platform Configuration</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
