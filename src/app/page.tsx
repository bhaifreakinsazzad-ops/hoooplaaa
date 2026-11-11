import { Metadata } from 'next';
import { CANONICAL_SERVICES } from '@/domain/catalog';
import ServiceCard from '@/components/ServiceCard';
import { useApp } from '@/components/providers/AppProviders';

export const metadata: Metadata = {
  title: 'HOOOPLAAA – Premium Digital Infrastructure',
  description: 'Attract. Connect. Convert. Grow. Premium services for Meta, Google, LinkedIn and more.',
};

export default function HomePage() {
  const { locale } = useApp();
  const services = CANONICAL_SERVICES.filter((s) => s.checkoutEnabled);

  return (
    <div className="max-w-screen-xl mx-auto p-4">
      {/* Hero */}
      <section className="text-center py-12 bg-hoooplaaa-canvas-cream">
        <h1 className="text-4xl font-manrope text-hoooplaaa-navy-950 mb-4">
          {locale === 'en' ? 'Premium Digital Infrastructure' : 'প্রিমিয়াম ডিজিটাল অবকাঠামো'}
        </h1>
        <p className="text-lg text-hoooplaaa-ink-secondary mb-6">
          {locale === 'en'
            ? 'Attract. Connect. Convert. Grow. Seamless setup for Meta, Google & LinkedIn.'
            : 'আকর্ষণ। যুক্ত করা। রূপান্তর। বৃদ্ধি। মেটা, গুগল ও লিঙ্কডইনের জন্য নির্বিঘ্ন সেটআপ।'}
        </p>
        <a
          href="/builder"
          className="btn btn-gold text-white px-6 py-3 rounded-md shadow-navy-card hover:bg-hoooplaaa-gold-400"
        >
          {locale === 'en' ? 'Start Building Your Package' : 'আপনার প্যাকেজ তৈরি করুন'}
        </a>
      </section>

      {/* Services Grid */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-hoooplaaa-navy-950 mb-6">
          {locale === 'en' ? 'Our Services' : 'আমাদের সেবা'}
        </h2>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <ServiceCard key={svc.id} item={svc} />
          ))}
        </div>
      </section>
    </div>
  );
}
