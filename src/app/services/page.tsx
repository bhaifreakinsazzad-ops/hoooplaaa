import React, { Suspense } from 'react';
import { ServicesCatalogClient } from '@/components/services/ServicesCatalogClient';

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-brand-muted">
          Loading HOOOPLAAA v3.0 service catalog...
        </div>
      }
    >
      <ServicesCatalogClient />
    </Suspense>
  );
}
