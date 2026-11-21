'use client';

import Link from 'next/link';
import { Service } from '@/domain/types';
import { useApp } from '@/components/providers/AppProviders';
import { ArrowRight, Clock, Layers } from 'lucide-react';

interface ServiceCardProps {
  item: Service;
}

export default function ServiceCard({ item }: ServiceCardProps) {
  const { locale } = useApp();

  const name = locale === 'en' ? item.name : item.nameBn;
  const desc = locale === 'en' ? item.shortDescription : item.shortDescriptionBn;
  const price = `৳${(item.basePriceMinor / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-hoooplaaa-gold-500/60 transition flex flex-col justify-between gap-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
            <Layers className="w-3.5 h-3.5 text-hoooplaaa-gold-600" />
            {item.sku}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {item.deliveryTarget}
          </span>
        </div>

        <h3 className="text-lg font-bold text-slate-900 leading-snug">
          <Link href={`/services/${item.slug}`} className="hover:text-hoooplaaa-gold-600 transition">
            {name}
          </Link>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold text-slate-900">{price}</div>
          <div className="text-[11px] text-slate-500">
            {item.billingPeriod === 'weekly'
              ? locale === 'en'
                ? 'per week'
                : 'সাপ্তাহিক'
              : locale === 'en'
              ? 'one-time setup'
              : 'এককালীন সেটআপ'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/services/${item.slug}`}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            {locale === 'en' ? 'Details' : 'বিস্তারিত'}
          </Link>
          <Link
            href={
              item.sku === 'HI-BUNDLE-3' ? '/build?preset=bundle' : `/build?sku=${item.sku}`
            }
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1 transition"
          >
            <span>{locale === 'en' ? 'Configure' : 'নির্বাচন'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
