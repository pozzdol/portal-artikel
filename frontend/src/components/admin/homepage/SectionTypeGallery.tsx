'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import type { SectionTypeInfo } from '@/lib/api/admin/types';

import { SectionThumbnail, sectionIcon } from './section-meta';

export type SectionTypeGalleryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: SectionTypeInfo[] | undefined;
  /** How many sections of each type already exist. */
  counts: Map<string, number>;
  onPick: (type: SectionTypeInfo) => void;
};

/** "+ Section" gallery: one card per section type with a layout sketch. */
export function SectionTypeGallery({
  open,
  onOpenChange,
  types,
  counts,
  onPick,
}: SectionTypeGalleryProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-line border-b p-5">
          <DialogTitle className="font-serif text-2xl font-medium">
            Tambah section
          </DialogTitle>
          <DialogDescription>
            Pilih tata letak. Formulir pengaturan terbuka dengan nilai bawaan,
            dan section baru ditaruh paling bawah.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-line grid min-h-0 grid-cols-1 gap-px overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {types
            ? types.map((t) => {
                const Icon = sectionIcon(t.type);
                const n = counts.get(t.type) ?? 0;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => onPick(t)}
                    className="bg-background hover:bg-muted focus-visible:ring-gold group flex flex-col gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
                  >
                    <SectionThumbnail
                      type={t.type}
                      className="group-hover:border-gold w-full transition-colors"
                    />
                    <span className="flex items-start gap-2.5">
                      <Icon className="text-gold-strong mt-0.5 size-4 shrink-0" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium">{t.label}</span>
                        <span className="text-meta text-xs leading-snug">
                          {t.description}
                        </span>
                        {n > 0 ? (
                          <span className="text-meta pt-1 text-[11px]">
                            Sudah dipakai {n}×
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                );
              })
            : Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="bg-background flex flex-col gap-3 p-4">
                  <Skeleton className="aspect-[8/5] w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
