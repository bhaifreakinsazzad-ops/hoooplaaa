import { Metadata } from 'next';
import { HomePageClient } from '@/components/home/HomePageClient';

export const metadata: Metadata = {
  title: 'HOOOPLAAA — Digital Infrastructure & Growth Engine',
  description:
    'Attract. Connect. Convert. Grow. Self-service agency commerce platform for Meta Business, Google Business Profile, and LinkedIn Company Page setups.',
};

export default function HomePage() {
  return <HomePageClient />;
}
