'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLinkIcon, LayoutTemplateIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PageHeader } from '@/components/admin/PageHeader';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';
import { Button } from '@/components/ui/shadcn/button';
import {
  useCreateSection,
  useDeleteSection,
  useHomepageSections,
  useReorderSections,
  useSectionTypes,
  useUpdateSection,
} from '@/lib/api/admin/homepage';
import { qk } from '@/lib/api/admin/keys';
import { getData } from '@/lib/api/admin/shared';
import type { HomepageSection } from '@/lib/api/admin/types';
import { toastApiError } from '@/lib/forms/serverErrors';

import { SectionEditSheet, type SectionEditTarget } from './SectionEditSheet';
import { SectionList, sectionVisibility } from './SectionList';
import { SectionTypeGallery } from './SectionTypeGallery';

const publicKey = [...qk.homepage.all, 'public-ids'] as const;

/** Ids of the sections the public homepage currently renders (non-empty data). */
function usePublicSectionIds() {
  return useQuery({
    queryKey: publicKey,
    queryFn: async ({ signal }) => {
      const data = await getData<{ sections: { id: number }[] }>(
        '/public/homepage',
        undefined,
        signal,
      );
      return new Set(data.sections.map((s) => s.id));
    },
    staleTime: 0,
  });
}

export function HomepageBuilder() {
  return (
    <PermissionGate perms={['homepage.manage']}>
      <HomepageBuilderInner />
    </PermissionGate>
  );
}

function HomepageBuilderInner() {
  const qc = useQueryClient();
  const sectionsQ = useHomepageSections();
  const typesQ = useSectionTypes();
  const publicQ = usePublicSectionIds();
  const reorder = useReorderSections();
  const update = useUpdateSection();
  const create = useCreateSection();
  const remove = useDeleteSection();

  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [target, setTarget] = React.useState<SectionEditTarget | null>(null);
  const [toDelete, setToDelete] = React.useState<HomepageSection | null>(null);
  const [pendingActive, setPendingActive] = React.useState<
    Map<number, boolean>
  >(() => new Map());

  const sections = React.useMemo(() => sectionsQ.data ?? [], [sectionsQ.data]);
  const typeByName = React.useMemo(
    () => new Map((typesQ.data ?? []).map((t) => [t.type, t])),
    [typesQ.data],
  );
  const typeLabels = React.useMemo(
    () => new Map((typesQ.data ?? []).map((t) => [t.type, t.label])),
    [typesQ.data],
  );
  const counts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sections) m.set(s.type, (m.get(s.type) ?? 0) + 1);
    return m;
  }, [sections]);

  const refreshPublic = React.useCallback(
    () => qc.invalidateQueries({ queryKey: publicKey }),
    [qc],
  );

  function applyOrder(ids: number[], message: string, undoIds?: number[]) {
    reorder.mutate(ids, {
      onSuccess: () => {
        void refreshPublic();
        toast.success(message, {
          action: undoIds
            ? {
                label: 'Urungkan',
                onClick: () => applyOrder(undoIds, 'Urutan dikembalikan.'),
              }
            : undefined,
        });
      },
      onError: (err) => toastApiError(err),
    });
  }

  function handleReorder(next: HomepageSection[]) {
    const previous = sections.map((s) => s.id);
    applyOrder(
      next.map((s) => s.id),
      'Urutan section disimpan.',
      previous,
    );
  }

  function handleToggle(s: HomepageSection, active: boolean) {
    setPendingActive((m) => new Map(m).set(s.id, active));
    update.mutate(
      { id: s.id, input: { is_active: active } },
      {
        onSuccess: () => {
          void refreshPublic();
          toast.success(
            active ? `“${s.label}” diaktifkan.` : `“${s.label}” dinonaktifkan.`,
          );
        },
        onError: (err) => toastApiError(err),
        onSettled: () =>
          setPendingActive((m) => {
            const n = new Map(m);
            n.delete(s.id);
            return n;
          }),
      },
    );
  }

  function handleDuplicate(s: HomepageSection) {
    const config = { ...(s.config ?? {}) };
    delete config.anchor_id; // anchors must stay unique on the page
    create.mutate(
      {
        type: s.type,
        label: `${s.label} (salinan)`.slice(0, 120),
        config,
        is_active: false,
      },
      {
        onSuccess: (copy) => {
          toast.success('Salinan dibuat di urutan paling bawah (nonaktif).', {
            action: {
              label: 'Edit',
              onClick: () => setTarget({ kind: 'edit', section: copy }),
            },
          });
        },
        onError: (err) => toastApiError(err),
      },
    );
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast.success(`Section “${toDelete.label}” dihapus.`);
      setToDelete(null);
      void refreshPublic();
    } catch (err) {
      toastApiError(err);
    }
  }

  const editingSection = target?.kind === 'edit' ? target.section : null;
  // Keep the sheet in sync with fresh list data (e.g. after a toggle).
  const liveEditing = editingSection
    ? (sections.find((s) => s.id === editingSection.id) ?? editingSection)
    : null;
  const sheetTarget: SectionEditTarget | null =
    target?.kind === 'edit' && liveEditing
      ? { kind: 'edit', section: liveEditing }
      : target;
  const sheetType = target
    ? typeByName.get(target.kind === 'edit' ? target.section.type : target.type)
    : undefined;

  const hiddenCount = sections.filter(
    (s) => sectionVisibility(s, publicQ.data) === 'empty' || !s.config_valid,
  ).length;
  const activeCount = sections.filter((s) => s.is_active).length;

  const header = (
    <PageHeader
      title="Beranda"
      description="Susun section beranda. Seret untuk mengubah urutan; perubahan langsung tersimpan dan tampil di situs."
      actions={
        <>
          <Button asChild variant="outline">
            <a href="/" target="_blank" rel="noopener noreferrer">
              Lihat Beranda
              <ExternalLinkIcon data-icon="inline-end" />
            </a>
          </Button>
          <Button
            type="button"
            variant="gold"
            onClick={() => setGalleryOpen(true)}
            disabled={!typesQ.data}
          >
            <PlusIcon data-icon="inline-start" />
            Tambah section
          </Button>
        </>
      }
    />
  );

  if (sectionsQ.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ListPageSkeleton rows={10} columns={3} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {sectionsQ.isError ? (
        <EmptyState
          title="Section beranda gagal dimuat"
          description="Periksa koneksi lalu coba lagi."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => void sectionsQ.refetch()}
            >
              Muat ulang
            </Button>
          }
        />
      ) : sections.length === 0 ? (
        <EmptyState
          icon={LayoutTemplateIcon}
          title="Beranda masih kosong"
          description="Tambahkan section pertama untuk mulai menyusun halaman depan."
          action={
            <Button
              type="button"
              variant="gold"
              onClick={() => setGalleryOpen(true)}
            >
              <PlusIcon data-icon="inline-start" />
              Tambah section
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-meta text-xs" aria-live="polite">
            {sections.length} section, {activeCount} aktif
            {hiddenCount > 0 ? `, ${hiddenCount} tidak tampil di beranda` : ''}.
            {reorder.isPending ? ' Menyimpan urutan…' : ''}
          </p>
          <SectionList
            sections={sections}
            publicIds={publicQ.data}
            pendingActive={pendingActive}
            typeLabels={typeLabels}
            disabled={reorder.isPending}
            onReorder={handleReorder}
            onToggleActive={handleToggle}
            onEdit={(s) => setTarget({ kind: 'edit', section: s })}
            onDuplicate={handleDuplicate}
            onDelete={setToDelete}
          />
          <p className="text-meta text-xs">
            Tip: fokuskan pegangan ⋮⋮ lalu tekan Spasi dan panah atas/bawah
            untuk memindahkan dengan papan ketik.
          </p>
        </div>
      )}

      <SectionTypeGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        types={typesQ.data}
        counts={counts}
        onPick={(t) => {
          setGalleryOpen(false);
          setTarget({ kind: 'create', type: t.type });
        }}
      />

      <SectionEditSheet
        target={sheetTarget}
        typeInfo={sheetType}
        hiddenBecauseEmpty={
          liveEditing
            ? sectionVisibility(liveEditing, publicQ.data) === 'empty'
            : false
        }
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        onSaved={() => void refreshPublic()}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Hapus section “${toDelete?.label ?? ''}”?`}
        description="Section dihapus permanen dari beranda. Pengaturannya tidak bisa dikembalikan; nonaktifkan saja bila hanya ingin menyembunyikannya."
        confirmLabel="Hapus section"
        destructive
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
