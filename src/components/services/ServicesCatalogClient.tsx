'use client';

import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/providers/AppProviders';
import { BRAND_V3, PARTNER_ECOSYSTEM_BOUNDARIES } from '@/domain/brand-v3';
import {
  V3_BUNDLES,
  V3_CORE_SERVICES,
  V3_DEPARTMENTS,
  V3_SPECIALIZED_ADDONS,
  V3_STOREFRONT_CATALOG,
  V3_VARIANTS,
  formatBdt,
  getActivePricingWindow,
  getEffectivePriceMinor,
} from '@/domain/catalog';
import { ServiceCard } from '@/components/ServiceCard';
import { AnimeReveal } from '@/components/motion/AnimeMotion';
import { ArrowRight, Search } from 'lucide-react';

type CatalogTab = 'all' | 'core' | 'variants' | 'bundles' | 'addons';

export function ServicesCatalogClient() {
  const { locale } = useApp();
  const searchParams = useSearchParams();
  const initialDept = searchParams.get('dept') || 'all';

  const [activeTab, setActiveTab] = useState<CatalogTab>(initialDept !== 'all' ? 'core' : 'all');
  const [selectedDept, setSelectedDept] = useState<string>(initialDept);
  const [selectedAddonGroup, setSelectedAddonGroup] = useState<string>('all');
  const [query, setQuery] = useState<string>('');

  const pricingWindow = getActivePricingWindow();

  const filteredServices = useMemo(() => {
    let list = V3_STOREFRONT_CATALOG;

    if (activeTab === 'core') {
      list = V3_CORE_SERVICES;
      if (selectedDept !== 'all') {
        list = list.filter((s) => s.categoryId === selectedDept);
      }
    } else if (activeTab === 'variants') {
      list = V3_VARIANTS;
    } else if (activeTab === 'bundles') {
      list = V3_BUNDLES;
    } else if (activeTab === 'addons') {
      list = V3_SPECIALIZED_ADDONS;
      if (selectedAddonGroup !== 'all') {
        list = list.filter((s) => s.addonGroup === selectedAddonGroup);
      }
    } else if (selectedDept !== 'all') {
      list = list.filter((s) => s.categoryId === selectedDept);
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (s) =>
        s.sku.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.nameBn.toLowerCase().includes(q) ||
        s.shortDescription.toLowerCase().includes(q) ||
        s.shortDescriptionBn.toLowerCase().includes(q)
    );
  }, [activeTab, selectedDept, selectedAddonGroup, query]);

  const addonGroups = ['all', 'Advertising', 'VA+', 'Leads & CRM', 'Tracking'];

  return (
    <div className="bg-brand-ivory text-brand-ink">
      {/* Dark Luxury Header Strip */}
      <section className="border-b border-brand-gold/25 bg-brand-forest py-14 text-brand-platinum">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-softgold">
            {locale === 'bn' ? pricingWindow.labelBn : pricingWindow.labelEn}
          </p>
          <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <h1 className="font-serif text-3xl font-semibold text-brand-ivory sm:text-5xl">
                {locale === 'bn'
                  ? 'সম্পূর্ণ সার্ভিস ক্যাটালগ (৫৭টি অনুমোদিত রো)'
                  : 'Complete Official Service Catalog (57 Approved Rows)'}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-brand-platinum/80 sm:text-base">
                {locale === 'bn'
                  ? '৬টি বিভাগ, ২৬টি কোর সার্ভিস, ৬টি ডেলিভারি মোড ও VA+ স্তর, ৩টি সিগনেচার বান্ডেল এবং ২২টি স্পেশালিস্ট অ্যাড-অন—প্রতিটি BDT-তে নির্ধারিত।'
                  : '26 Core Services across 6 approved departments, 6 Advertising & VA+ tiers, 3 Signature Bundles, and 22 Specialist Add-ons under Pricing Revision 4.4.'}
              </p>
            </div>
            <Link
              href="/build"
              className="inline-flex shrink-0 items-center gap-2 bg-brand-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] text-brand-forest hover:bg-brand-softgold"
            >
              <span>{locale === 'bn' ? 'প্যাকেজ বিল্ডার খুলুন' : 'Open Package Builder'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Filters & Search Controls */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="border border-brand-hairline bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            {/* Primary Tabs */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', labelEn: 'All (57)', labelBn: 'সব (৫৭)' },
                  { id: 'core', labelEn: 'Core Services (26)', labelBn: 'কোর সার্ভিস (২৬)' },
                  { id: 'variants', labelEn: 'Modes & VA+ (6)', labelBn: 'মোড ও VA+ (৬)' },
                  { id: 'bundles', labelEn: 'Bundles (3)', labelBn: 'বান্ডেল (৩)' },
                  { id: 'addons', labelEn: 'Specialist Add-ons (22)', labelBn: 'অ্যাড-অন (২২)' },
                ] as Array<{ id: CatalogTab; labelEn: string; labelBn: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== 'core' && tab.id !== 'all') setSelectedDept('all');
                  }}
                  className={`border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === tab.id
                      ? 'border-brand-forest bg-brand-forest text-brand-ivory'
                      : 'border-brand-hairline bg-brand-ivory/50 text-brand-ink hover:border-brand-gold'
                  }`}
                >
                  {locale === 'bn' ? tab.labelBn : tab.labelEn}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  locale === 'bn'
                    ? 'SKU বা সার্ভিস খুঁজুন (যেমন B01, PK01, VA+)'
                    : 'Search by SKU or service (e.g., B01, PK01, VA+)'
                }
                className="w-full border border-brand-hairline bg-brand-ivory/40 py-2 pl-9 pr-3 text-sm text-brand-forest placeholder:text-brand-muted focus:border-brand-forest focus:outline-none"
              />
            </div>
          </div>

          {/* Sub-filter: 6 Departments (when viewing All or Core) */}
          {(activeTab === 'all' || activeTab === 'core') && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-hairline pt-4">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                {locale === 'bn' ? 'বিভাগ:' : 'Department:'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedDept('all')}
                className={`border px-3 py-1 text-xs font-medium ${
                  selectedDept === 'all'
                    ? 'border-brand-emerald bg-brand-emerald text-white'
                    : 'border-brand-hairline text-brand-ink hover:border-brand-gold'
                }`}
              >
                {locale === 'bn' ? 'সব বিভাগ' : 'All 6 Departments'}
              </button>
              {V3_DEPARTMENTS.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setSelectedDept(dept.id)}
                  className={`border px-3 py-1 text-xs font-medium ${
                    selectedDept === dept.id
                      ? 'border-brand-emerald bg-brand-emerald text-white'
                      : 'border-brand-hairline text-brand-ink hover:border-brand-gold'
                  }`}
                >
                  {dept.code}. {locale === 'bn' ? dept.nameBn : dept.name}
                </button>
              ))}
            </div>
          )}

          {/* Sub-filter: Add-on Groups */}
          {activeTab === 'addons' && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-hairline pt-4">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                {locale === 'bn' ? 'গ্রুপ:' : 'Add-on Group:'}
              </span>
              {addonGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setSelectedAddonGroup(group)}
                  className={`border px-3 py-1 text-xs font-medium ${
                    selectedAddonGroup === group
                      ? 'border-brand-emerald bg-brand-emerald text-white'
                      : 'border-brand-hairline text-brand-ink hover:border-brand-gold'
                  }`}
                >
                  {group === 'all' ? (locale === 'bn' ? 'সব অ্যাড-অন (২২)' : 'All 22 Add-ons') : group}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results Count & Pricing Ethics Notice */}
        <div className="mt-6 flex flex-col justify-between gap-2 text-xs text-brand-muted sm:flex-row sm:items-center">
          <p className="font-medium text-brand-forest">
            {locale === 'bn'
              ? `${filteredServices.length}টি সার্ভিস প্রদর্শিত হচ্ছে`
              : `Showing ${filteredServices.length} approved catalog items`}
          </p>
          <p>
            {locale === 'bn'
              ? BRAND_V3.commercialWindow.standardNoteBn
              : BRAND_V3.commercialWindow.standardNoteEn}
          </p>
        </div>

        {/* Service Cards Grid */}
        {filteredServices.length === 0 ? (
          <div className="mt-8 border border-brand-hairline bg-white p-12 text-center">
            <p className="font-serif text-xl text-brand-forest">
              {locale === 'bn' ? 'কোনো সার্ভিস পাওয়া যায়নি' : 'No matching catalog items found'}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedDept('all');
                setSelectedAddonGroup('all');
                setActiveTab('all');
              }}
              className="mt-4 border border-brand-forest px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-forest"
            >
              {locale === 'bn' ? 'ফিল্টার রিসেট করুন' : 'Reset Filters'}
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((srv) => (
              <div key={srv.sku} className="relative flex flex-col">
                <ServiceCard service={srv} compact={srv.catalogKind === 'specialized_addon'} />
                {srv.aliasOf && (
                  <p className="border-x border-b border-brand-hairline bg-brand-ivory px-4 py-2 text-[11px] text-brand-muted">
                    {locale === 'bn'
                      ? `নোট: ${srv.sku} হলো ${srv.aliasOf}-এর বিকল্প নাম; একসাথে ডাবল বিল করা হয় না।`
                      : `Alias guard: ${srv.sku} maps to ${srv.aliasOf} and is never double-billed in checkout.`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Complete Quick-Reference Pricing Ledger Table for Transparent Audits */}
        <AnimeReveal className="mt-16">
          <div className="border border-brand-hairline bg-white p-6 sm:p-8">
            <h2 className="font-serif text-2xl font-semibold text-brand-forest">
              {locale === 'bn'
                ? 'বাণিজ্যিক নিয়ম ও পার্টনার ইকোসিস্টেম সীমারেখা'
                : 'Commercial Governance & Partner Ecosystem Boundaries'}
            </h2>
            <p className="mt-2 text-sm text-brand-muted">
              {locale === 'bn'
                ? BRAND_V3.commercialWindow.subscriptionIntroNoteBn
                : BRAND_V3.commercialWindow.subscriptionIntroNoteEn}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {PARTNER_ECOSYSTEM_BOUNDARIES.map((p) => (
                <div key={p.brand} className="border border-brand-hairline bg-brand-ivory/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-forest">
                    {p.brand} · {p.role === 'owned' ? 'HOOOPLAAA Checkout' : 'Separate Partner'}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-brand-muted">
                    {locale === 'bn' ? p.ownsBn : p.owns}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-brand-hairline pt-5 text-xs text-brand-muted">
              <span>
                {locale === 'bn'
                  ? 'স্ট্যান্ডার্ড বনাম লঞ্চ মূল্য তুলনা (Rev 4.4)'
                  : `Active Window: ${pricingWindow.labelEn} · Sample PK01: ${formatBdt(
                      getEffectivePriceMinor(V3_BUNDLES[0])
                    )}`}
              </span>
              <Link
                href="/build"
                className="font-bold uppercase tracking-wider text-brand-forest hover:text-brand-emerald"
              >
                {locale === 'bn' ? 'এখনই কোট তৈরি করুন →' : 'Configure Your Package →'}
              </Link>
            </div>
          </div>
        </AnimeReveal>
      </section>
    </div>
  );
}
