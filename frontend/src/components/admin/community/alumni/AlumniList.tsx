'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AwardIcon,
  CopyIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PageHeader } from '@/components/admin/PageHeader';
import { SortableList } from '@/components/admin/SortableList';
import { dragHandleProps } from '@/components/admin/homepage/drag-handle';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Switch } from '@/components/ui/shadcn/switch';
import {
  useAlumniList,
  useDeleteAlumni,
  useReorderAlumni,
  useUpdateAlumni,
} from '@/lib/api/admin/alumni';
import { useMediaByIds } from '@/lib/api/admin/media';
import type { AdminAlumni } from '@/lib/api/admin/types';
import { toastApiError } from '@/lib/forms/serverErrors';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useListParams } from '@/lib/hooks/useListParams';
import { DRAFT_PREFIX, writeDraft } from '@/lib/hooks/useLocalDraft';

import { ALUMNI_DUPLICATE_DRAFT_KEY, alumniDuplicateDraft } from './AlumniForm';

const PER_PAGE = 100;

function AlumniPhoto({ id }: { id: number | null }) {
  const { byId } = useMediaByIds(id ? [id] : []);
  const item = id ? byId.get(id) : undefined;
  return (
    <div className="bg-muted border-line relative size-10 shrink-0 overflow-hidden border">
      {item ? (
        <Image
          src={item.url}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
        />
      ) : null}
    </div>
  );
}

export function AlumniList() {
  const router = useRouter();
  const { params, set } = useListParams({ q: '', status: '', page: 1 });
  const [search, setSearch] = useState(params.q);
  const debouncedQ = useDebounce(search, 400);
  const [toDelete, setToDelete] = useState<AdminAlumni | null>(null);

  const query = useAlumniList({
    q: debouncedQ || undefined,
    status: (params.status || undefined) as AdminAlumni['status'] | undefined,
    per_page: PER_PAGE,
  });
  const reorder = useReorderAlumni();
  const updateOne = useUpdateAlumni();
  const del = useDeleteAlumni();

  useEffect(() => {
    if (debouncedQ !== params.q) set({ q: debouncedQ }, { resetPage: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const items = query.data?.items ?? [];
  const filtered = !!params.q || !!params.status;

  function duplicate(item: AdminAlumni) {
    writeDraft(
      DRAFT_PREFIX + ALUMNI_DUPLICATE_DRAFT_KEY,
      alumniDuplicateDraft(item),
    );
    router.push('/admin/alumni/new');
  }

  function toggleFeatured(item: AdminAlumni, next: boolean) {
    updateOne.mutate(
      {
        id: item.id,
        input: {
          name: item.name,
          slug: item.slug,
          role_title: item.role_title,
          class_year: item.class_year,
          short_bio: item.short_bio,
          story_json: item.story_json,
          story_html: item.story_html,
          photo_media_id: item.photo_media_id,
          is_featured: next,
          sort_order: item.sort_order,
          status: item.status,
          seo_title: item.seo.title,
          seo_description: item.seo.description,
        },
      },
      { onError: (err) => toastApiError(err) },
    );
  }

  function handleReorder(next: AdminAlumni[]) {
    reorder.mutate(
      next.map((it, i) => ({ id: it.id, sort_order: i })),
      { onError: (err) => toastApiError(err) },
    );
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success('Tokoh alumni dihapus.');
      setToDelete(null);
    } catch (err) {
      toastApiError(err);
    }
  }

  if (query.isLoading && !query.data) return <ListPageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tokoh Alumni"
        description="Profil alumni yang tampil di /tokoh. Seret untuk mengurutkan."
        actions={
          <Button asChild variant="gold">
            <Link href="/admin/alumni/new">
              <PlusIcon data-icon="inline-start" />
              Tambah tokoh
            </Link>
          </Button>
        }
      />

      <DataTableToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Cari tokoh…',
        }}
      >
        <Select
          value={params.status || 'all'}
          onValueChange={(v) => set({ status: v === 'all' ? '' : v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="draft">Draf</SelectItem>
            <SelectItem value="published">Terbit</SelectItem>
          </SelectContent>
        </Select>
      </DataTableToolbar>

      {filtered ? (
        <p className="text-muted-foreground text-xs">
          Urutan hanya dapat diubah saat pencarian/filter kosong.
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={AwardIcon}
          title="Belum ada tokoh alumni"
          description="Tambahkan profil alumni pertama."
        />
      ) : (
        <SortableList
          items={items}
          getId={(it) => it.id}
          onReorder={handleReorder}
          disabled={filtered}
          renderItem={(item, { handleProps, isDragging }) => (
            <div
              className={`border-line bg-background flex items-center gap-3 border p-3 ${isDragging ? 'shadow-lg' : ''}`}
            >
              <button
                type="button"
                {...dragHandleProps(handleProps)}
                className="text-muted-foreground hover:text-foreground cursor-grab touch-none disabled:cursor-not-allowed disabled:opacity-30"
                disabled={filtered}
                aria-label="Seret untuk mengurutkan"
              >
                <GripVerticalIcon className="size-4" />
              </button>
              <AlumniPhoto id={item.photo_media_id} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/alumni/${item.id}`}
                  className="font-medium hover:underline"
                >
                  {item.name}
                </Link>
                <p className="text-muted-foreground truncate text-xs">
                  {item.role_title}
                  {item.class_year ? ` · Angkatan ${item.class_year}` : ''}
                </p>
              </div>
              <StatusBadge status={item.status} />
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.is_featured}
                  onCheckedChange={(v) => toggleFeatured(item, v)}
                  aria-label="Tampil di beranda"
                />
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  Beranda
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Aksi lainnya"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/alumni/${item.id}`}>
                      <PencilIcon data-icon="inline-start" />
                      Sunting
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => duplicate(item)}>
                    <CopyIcon data-icon="inline-start" />
                    Duplikat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setToDelete(item)}
                  >
                    <TrashIcon data-icon="inline-start" />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Hapus tokoh alumni"
        description={`Hapus profil "${toDelete?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus tokoh"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
