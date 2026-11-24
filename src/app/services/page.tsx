import { Metadata } from 'next';
import { ServicesCatalogClient } from '@/components/services/ServicesCatalogClient';

export const metadata: Metadata = {
  title: 'HOOOPLAAA — Approved Services',
  description: 'Explore fixed-price digital infrastructure services offered by HOOOPLAAA.',
};

export default function ServicesPage() {
  return <ServicesCatalogClient />;
}
