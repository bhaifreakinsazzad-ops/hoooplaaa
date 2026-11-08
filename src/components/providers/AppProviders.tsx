'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type DesignConcept = 'concept-a' | 'concept-b' | 'concept-c';
type Locale = 'en' | 'bn';

interface AppContextType {
  concept: DesignConcept;
  setConcept: (concept: DesignConcept) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const AppContext = createContext<AppContextType>({
  concept: 'concept-c',
  setConcept: () => {},
  locale: 'en',
  setLocale: () => {},
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [concept, setConcept] = useState<DesignConcept>('concept-c');
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', concept);
  }, [concept]);

  return (
    <AppContext.Provider value={{ concept, setConcept, locale, setLocale }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
