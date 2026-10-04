import { NotFoundContent } from '@/components/layout/NotFoundContent';
import { PublicShell } from '@/components/layout/PublicShell';

export default async function NotFound() {
  return (
    <PublicShell>
      <NotFoundContent />
    </PublicShell>
  );
}
