import type { Metadata } from 'next';

import { HomepageBuilder } from '@/components/admin/homepage/HomepageBuilder';

export const metadata: Metadata = { title: 'Homepage' };

export default function AdminHomepagePage() {
  return <HomepageBuilder />;
}
