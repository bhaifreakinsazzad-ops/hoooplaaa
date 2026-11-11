"use client";

import { Service } from '@/domain/types';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/providers/AppProviders';

interface ServiceCardProps {
  item: Service;
}

export default function ServiceCard({ item }: ServiceCardProps) {
  const router = useRouter();
  const { locale } = useApp();

  const name = locale === 'en' ? item.name : item.nameBn;
  const desc = locale === 'en' ? item.shortDescription : item.shortDescriptionBn;
  const price = `৳${(item.basePriceMinor / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const handleSelect = () => {
    router.push(`/builder?sku=${item.sku}`);
  };

  return (
    <div className="service-card rounded-lg shadow-navy-card p-4 bg-hoooplaaa-canvas-cream hover:shadow-gold-glow transition-shadow">
      <div className="icon text-3xl mb-2">📦</div>
      <h3 className="text-hoooplaaa-navy-950 text-lg font-semibold mb-1">{name}</h3>
      <p className="text-hoooplaaa-ink-secondary text-sm mb-3">{desc}</p>
      <div className="flex justify-between items-center">
        <span className="price text-hoooplaaa-gold-500 font-medium">{price}</span>
        <button
          className="select-link bg-hoooplaaa-gold-500 text-white px-3 py-1 rounded-md hover:bg-hoooplaaa-gold-400"
          onClick={handleSelect}
        >
          {locale === 'en' ? 'Select' : 'নির্বাচন'}
        </button>
      </div>
    </div>
  );
}
