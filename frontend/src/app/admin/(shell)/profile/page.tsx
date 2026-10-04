import type { Metadata } from 'next';

import { ProfileView } from '@/components/admin/profile/ProfileView';

export const metadata: Metadata = { title: 'Profil saya' };

export default function AdminProfilePage() {
  return <ProfileView />;
}
