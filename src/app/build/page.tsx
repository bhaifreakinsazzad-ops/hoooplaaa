import React, { Suspense } from 'react';
import { ConfiguratorWizard } from '@/components/configurator/ConfiguratorWizard';

export default function BuildPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-500">
          Loading Package Configurator...
        </div>
      }
    >
      <ConfiguratorWizard />
    </Suspense>
  );
}
