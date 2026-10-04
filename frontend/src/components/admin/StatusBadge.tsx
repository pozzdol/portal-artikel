import { Badge } from '@/components/ui/shadcn/badge';
import { cn } from '@/lib/cn';

/** Union of every status/flag string shown as a StatusBadge across admin lists. */
export type Status =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'archived'
  | 'cancelled'
  | 'active'
  | 'inactive';

const LABEL: Record<Status, string> = {
  draft: 'Draf',
  scheduled: 'Terjadwal',
  published: 'Terbit',
  archived: 'Arsip',
  cancelled: 'Dibatalkan',
  active: 'Aktif',
  inactive: 'Nonaktif',
};

const CLASS: Record<Status, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-gold/15 text-gold-strong',
  published: 'bg-success/10 text-success',
  archived: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  active: 'bg-success/10 text-success',
  inactive: 'bg-muted text-muted-foreground',
};

export type StatusBadgeProps = {
  status: Status;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent font-normal', CLASS[status], className)}
    >
      {LABEL[status]}
    </Badge>
  );
}
