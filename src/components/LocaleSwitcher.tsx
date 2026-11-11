import { useRouter } from 'next/navigation';
import { useApp } from '@/components/providers/AppProviders';

export default function LocaleSwitcher() {
  const router = useRouter();
  const { locale, setLocale } = useApp();

  const toggle = () => {
    const newLang = locale === 'en' ? 'bn' : 'en';
    setLocale(newLang);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', newLang);
    router.replace(url.toString());
  };

  return (
    <button className="locale" onClick={toggle} aria-label="Switch language">
      {locale === 'en' ? 'বাংলা / EN' : 'EN / বাংলা'}
    </button>
  );
}
