'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useApp } from '@/components/providers/AppProviders';
import { BRAND_V3 } from '@/domain/brand-v3';
import { V3_DEPARTMENTS } from '@/domain/catalog';
import { Mail, MapPin, Phone } from 'lucide-react';

export function Footer() {
  const { locale } = useApp();

  return (
    <footer className="border-t border-brand-gold/25 bg-brand-forest text-brand-platinum">
      {/* Commercial Governance Bar */}
      <div className="border-b border-brand-teal/80 bg-brand-teal/35">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 text-xs sm:grid-cols-2 lg:grid-cols-4 sm:px-6 lg:px-8">
          <div>
            <p className="font-semibold uppercase tracking-wider text-brand-softgold">
              {locale === 'bn' ? 'সরাসরি মালিকানা' : 'Direct Asset Ownership'}
            </p>
            <p className="mt-1 leading-relaxed text-brand-platinum/80">
              {locale === 'bn'
                ? 'ক্লায়েন্টের প্রতিটি ডিজিটাল অ্যাকাউন্ট ও পোর্টফোলিও সরাসরি ক্লায়েন্টের মালিকানায় থাকে।'
                : 'Every Meta Portfolio, Google Profile, LinkedIn Page, and tracking container remains 100% client-owned.'}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-brand-softgold">
              {locale === 'bn' ? 'স্বচ্ছ মূল্য তালিকা' : 'Transparent BDT Pricing'}
            </p>
            <p className="mt-1 leading-relaxed text-brand-platinum/80">
              {locale === 'bn'
                ? BRAND_V3.commercialWindow.standardNoteBn
                : BRAND_V3.commercialWindow.standardNoteEn}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-brand-softgold">
              {locale === 'bn' ? 'পৃথক মিডিয়া বাজেট' : 'Separate Media Spend'}
            </p>
            <p className="mt-1 leading-relaxed text-brand-platinum/80">
              {locale === 'bn'
                ? 'বিজ্ঞাপনের বাজেট সরাসরি অ্যাড প্ল্যাটফর্মে পরিশোধিত হয়; সার্ভিস ফি থেকে সম্পূর্ণ আলাদা।'
                : 'Paid advertising budgets are paid directly by clients to ad platforms and excluded from service fees.'}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-brand-softgold">
              {locale === 'bn' ? 'কোনো অবাস্তব গ্যারান্টি নয়' : 'Evidence, Not Guarantees'}
            </p>
            <p className="mt-1 leading-relaxed text-brand-platinum/80">
              {locale === 'bn' ? BRAND_V3.promiseBn : BRAND_V3.promise}
            </p>
          </div>
        </div>
      </div>

      {/* Main Footer Columns */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-12 lg:px-8">
        {/* Brand Emblem & Identity */}
        <div className="md:col-span-4 space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-brand-gold/35 bg-brand-forest p-1">
              <Image
                src={BRAND_V3.assets.squareDp}
                alt="HOOOPLAAA INCORPORATED Official Emblem"
                width={64}
                height={64}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="font-serif text-base font-semibold tracking-[0.12em] text-brand-ivory">
                {BRAND_V3.legalName}
              </p>
              <p className="mt-0.5 text-xs tracking-wider text-brand-softgold">
                {locale === 'bn' ? BRAND_V3.logoPhraseBn : BRAND_V3.logoPhrase}
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-brand-platinum/80">
            {locale === 'bn' ? BRAND_V3.positioningBn : BRAND_V3.positioning}
          </p>

          <p className="text-xs font-medium tracking-wider text-brand-softgold/90">
            {locale === 'bn' ? BRAND_V3.supportingLineBn : BRAND_V3.supportingLine}
          </p>
        </div>

        {/* 6 Approved Departments */}
        <div className="md:col-span-3">
          <h3 className="font-serif text-sm font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {locale === 'bn' ? '৬টি অনুমোদিত বিভাগ' : 'Six Departments'}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {V3_DEPARTMENTS.map((dept) => (
              <li key={dept.id}>
                <Link
                  href={`/services?dept=${dept.id}`}
                  className="text-brand-platinum/80 transition-colors hover:text-brand-softgold"
                >
                  {locale === 'bn' ? dept.nameBn : dept.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Platform & Legal Policies */}
        <div className="md:col-span-2">
          <h3 className="font-serif text-sm font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {locale === 'bn' ? 'প্ল্যাটফর্ম ও নীতিমালা' : 'Platform & Policies'}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href="/packages" className="text-brand-platinum/80 hover:text-brand-softgold">
                {locale === 'bn' ? 'বান্ডেল ও VA+' : 'Bundles & VA+ Tiers'}
              </Link>
            </li>
            <li>
              <Link href="/build" className="text-brand-platinum/80 hover:text-brand-softgold">
                {locale === 'bn' ? 'প্যাকেজ বিল্ডার' : 'Package Configurator'}
              </Link>
            </li>
            <li>
              <Link href="/audit" className="text-brand-platinum/80 hover:text-brand-softgold">
                {locale === 'bn' ? 'ফ্রি অডিট অনুরোধ' : 'Free Readiness Audit'}
              </Link>
            </li>
            <li>
              <Link href="/policies/terms" className="text-brand-platinum/80 hover:text-brand-softgold">
                {locale === 'bn' ? 'শর্তাবলী' : 'Terms of Service'}
              </Link>
            </li>
            <li>
              <Link href="/policies/refund" className="text-brand-platinum/80 hover:text-brand-softgold">
                {locale === 'bn' ? 'রিফান্ড ও ক্যান্সেলেশন' : 'Refund & Cancellation'}
              </Link>
            </li>
            <li>
              <Link href="/policies/delivery" className="text-brand-platinum/80 hover:text-brand-softgold">
                {locale === 'bn' ? 'ডেলিভারি নীতিমালা' : 'Delivery & SLA Policy'}
              </Link>
            </li>
            <li>
              <Link href="/policies/privacy" className="text-brand-platinum/80 hover:text-brand-softgold">
                {locale === 'bn' ? 'প্রাইভেসি পলিসি' : 'Privacy Policy'}
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact & Operations */}
        <div className="md:col-span-3">
          <h3 className="font-serif text-sm font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {locale === 'bn' ? 'যোগাযোগ ও পোর্টাল' : 'Operations & Contact'}
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-brand-platinum/85">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
              <span>
                {locale === 'bn' ? BRAND_V3.contact.locationBn : BRAND_V3.contact.location} ·{' '}
                {BRAND_V3.contact.timezone}
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-brand-gold" />
              <span className="tabular-price">{BRAND_V3.contact.whatsapp}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-brand-gold" />
              <span>{BRAND_V3.contact.email}</span>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            <Link
              href="/dashboard"
              className="border border-brand-gold/30 px-3 py-1.5 font-medium text-brand-ivory hover:border-brand-gold"
            >
              {locale === 'bn' ? 'ক্লায়েন্ট ওয়ার্কস্পেস' : 'Client Workspace'}
            </Link>
            <Link
              href="/admin"
              className="border border-brand-teal px-3 py-1.5 font-medium text-brand-platinum/80 hover:border-brand-gold/40 hover:text-brand-ivory"
            >
              {locale === 'bn' ? 'অ্যাডমিন কনসোল' : 'Admin Console'}
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Governance Bar */}
      <div className="border-t border-brand-teal/70">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-5 text-[11px] text-brand-platinum/65 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {BRAND_V3.legalName}. {BRAND_V3.commercialWindow.trademarkNoteEn}
          </p>
          <p className="whitespace-nowrap text-brand-softgold/80">
            Brand Book v{BRAND_V3.version} · {BRAND_V3.pricingBaseline}
          </p>
        </div>
      </div>
    </footer>
  );
}
