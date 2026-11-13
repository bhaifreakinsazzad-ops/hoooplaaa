'use client';

import { Metadata } from 'next';
import { CANONICAL_SERVICES } from '@/domain/catalog';
import ServiceCard from '@/components/ServiceCard';
import { useApp } from '@/components/providers/AppProviders';

export const metadata: Metadata = {
  title: 'HOOOPLAAA – Services',
  description: 'Explore premium digital infrastructure services offered by HOOOPLAAA.',
};

export default function ServicesPage() {
  const { locale } = useApp();
  const services = CANONICAL_SERVICES.filter((s) => s.checkoutEnabled);

  return (
    <div className="max-w-screen-xl mx-auto p-4">
      <h1 className="text-3xl font-manrope text-hoooplaaa-navy-950 mb-6 text-center">
        {locale === 'en' ? 'Our Services' : 'আমাদের সেবা'}
      </h1>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => (
          <ServiceCard key={svc.id} item={svc} />
        ))}
      </div>
    </div>
  );
}
