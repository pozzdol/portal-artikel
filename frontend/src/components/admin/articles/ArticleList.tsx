'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FilePenLineIcon,
  PlusIcon,
  SearchXIcon,
  Trash2Icon,
} from 'lucide-react';

import { AuthorSelect } from '@/components/admin/AuthorSelect';
import { CategoryCombobox } from '@/components/admin/CategoryCombobox';
import {
  DataTable,
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from '@/components/admin/DataTable';
import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { usePermission } from '@/components/admin/shell/PermissionGate';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { useArticles } from '@/lib/api/admin/articles';
import { useMe } from '@/lib/api/admin/auth';
import type { AdminArticleItem } from '@/lib/api/admin/types';
import { formatWib, relativeWib } from '@/lib/datetime';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useListParams } from '@/lib/hooks/useListParams';

import { ArticleRowActions } from './ArticleRowActions';
import {
  isArticleStatus,
  normalizeSort,
  STATUS_OPTIONS,
  type ArticlePerms,
} from './article-form';

const ALL = '__all__';
const PER_PAGE = 20;
const numberFmt = new Intl.NumberFormat('id-ID');

const LIST_DEFAULTS = {
  q: '',
  status: '',
  category: '',
  author: 0,
  sort: '-updated_at',
  page: 1,
  trashed: false,
};

function categoryLabel(a: AdminArticleItem): string {
  return a.category.parent
    ? `${a.category.parent.name} › ${a.category.name}`
    : a.category.name;
}

function DateCell({ a, trashed }: { a: AdminArticleItem; trashed: boolean }) {
  const main = trashed ? a.deleted_at : a.published_at;
  return (
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      <span className="text-foreground">
        {main
          ? formatWib(main, 'd MMM yyyy, HH:mm')
          : a.status === 'draft'
            ? 'Belum terbit'
            : '—'}
      </span>
      <span className="text-muted-foreground text-xs">
        {trashed ? 'dihapus' : `diperbarui ${relativeWib(a.updated_at)}`}
      </span>
    </div>
  );
}

export function ArticleList() {
  const { params, set } = useListParams(LIST_DEFAULTS);
  const { data: me } = useMe();
  const perms: ArticlePerms = {
    create: usePermission('articles.create'),
    update: usePermission('articles.update'),
    updateAny: usePermission('articles.update_any'),
    publish: usePermission('articles.publish'),
    remove: usePermission('articles.delete'),
  };

  // Search box is local; the URL follows after a pause.
  const [search, setSearch] = React.useState(params.q);
  const debouncedSearch = useDebounce(search, 350);
  React.useEffect(() => {
    if (debouncedSearch !== params.q) set({ q: debouncedSearch });
    // Only react to the typed text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const status = isArticleStatus(params.status) ? params.status : undefined;
  const sort = normalizeSort(params.sort);
  const { data, isLoading, isFetching, isError, refetch } = useArticles({
    q: params.q || undefined,
    status,
    category: params.category || undefined,
    author: params.author > 0 ? params.author : undefined,
    trashed: params.trashed || undefined,
    sort,
    page: params.page,
    per_page: PER_PAGE,
  });

  const filtered =
    !!params.q || !!status || !!params.category || params.author > 0;

  const columns = React.useMemo<DataTableColumnDef<AdminArticleItem>[]>(() => {
    const col = createDataTableColumnHelper<AdminArticleItem>();
    return [
      col.display({
        id: 'title',
        header: 'Judul',
        meta: { sortKey: 'title' },
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex max-w-[34rem] min-w-[10rem] flex-col gap-1 whitespace-normal sm:min-w-[14rem]">
              <Link
                href={`/admin/articles/${a.id}`}
                className="text-foreground hover:text-gold-strong leading-snug font-medium underline-offset-2 hover:underline"
              >
                {a.title}
              </Link>
              <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                <span>{categoryLabel(a)}</span>
                {a.is_featured ? (
                  <Badge
                    variant="outline"
                    className="border-gold/40 text-gold-strong h-5 px-1.5 text-xs"
                  >
                    Unggulan
                  </Badge>
                ) : null}
                {a.is_breaking ? (
                  <Badge
                    variant="outline"
                    className="border-destructive/40 text-destructive h-5 px-1.5 text-xs"
                  >
                    Breaking
                  </Badge>
                ) : null}
                <span className="lg:hidden">
                  {a.author.display_name}
                  {a.published_at
                    ? ` · ${formatWib(a.published_at, 'd MMM yyyy')}`
                    : ''}
                </span>
              </div>
            </div>
          );
        },
      }),
      col.display({
        id: 'author',
        header: 'Penulis',
        meta: { hideBelow: 'lg' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.author.display_name}
          </span>
        ),
      }),
      col.display({
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      }),
      col.display({
        id: 'published_at',
        header: params.trashed ? 'Dihapus' : 'Tanggal terbit',
        meta: { sortKey: 'published_at', hideBelow: 'md' },
        cell: ({ row }) => (
          <DateCell a={row.original} trashed={params.trashed} />
        ),
      }),
      col.display({
        id: 'view_count',
        header: 'Dibaca',
        meta: {
          sortKey: 'view_count',
          align: 'right',
          hideBelow: 'xl',
          compact: true,
        },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {numberFmt.format(row.original.view_count)}
          </span>
        ),
      }),
    ];
  }, [params.trashed]);

  const emptyNode = params.trashed ? (
    <EmptyState
      icon={Trash2Icon}
      title="Sampah kosong"
      description="Artikel yang dihapus akan muncul di sini dan bisa dipulihkan."
    />
  ) : filtered ? (
    <EmptyState
      icon={SearchXIcon}
      title="Tidak ada artikel yang cocok"
      description="Ubah kata kunci atau filter untuk melihat artikel lain."
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearch('');
            set({ q: '', status: '', category: '', author: 0 });
          }}
        >
          Hapus filter
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={FilePenLineIcon}
      title="Belum ada artikel"
      description="Tulis artikel pertama untuk mengisi portal."
      action={
        perms.create ? (
          <Button asChild size="sm" variant="gold">
            <Link href="/admin/articles/new">
              <PlusIcon />
              Tulis artikel
            </Link>
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Artikel"
        description="Kajian, berita, dan tulisan yang tampil di portal."
        actions={
          perms.create ? (
            <Button asChild variant="gold">
              <Link href="/admin/articles/new">
                <PlusIcon />
                Tulis artikel
              </Link>
            </Button>
          ) : null
        }
      />

      <Tabs
        value={params.trashed ? 'trash' : 'all'}
        onValueChange={(v) => set({ trashed: v === 'trash' })}
      >
        <TabsList variant="line" className="h-11 lg:h-9">
          <TabsTrigger value="all">Semua artikel</TabsTrigger>
          <TabsTrigger value="trash">Sampah</TabsTrigger>
        </TabsList>
      </Tabs>

      {isError ? (
        <div className="border-destructive/40 text-destructive flex items-center justify-between gap-3 border px-4 py-3 text-sm">
          <span>Daftar artikel gagal dimuat.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        isLoading={isLoading || isFetching}
        sort={sort}
        onSortChange={(s) => set({ sort: normalizeSort(s) })}
        page={params.page}
        onPageChange={(p) => set({ page: p }, { push: true })}
        getRowId={(a) => a.id}
        empty={emptyNode}
        rowActions={(a) => (
          <ArticleRowActions
            article={a}
            trashed={params.trashed}
            perms={perms}
            meId={me?.id ?? null}
          />
        )}
        toolbar={
          <DataTableToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Cari judul…',
            }}
          >
            <Select
              value={status ?? ALL}
              onValueChange={(v) => set({ status: v === ALL ? '' : v })}
            >
              <SelectTrigger
                className="w-full sm:w-40"
                aria-label="Filter status"
              >
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua status</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-full sm:w-52">
              <CategoryCombobox
                value={params.category || null}
                onChange={(slug) => set({ category: slug ?? '' })}
                placeholder="Semua kategori"
              />
            </div>
            {perms.create ? (
              <div className="w-full sm:w-52">
                <AuthorSelect
                  value={params.author > 0 ? params.author : null}
                  onChange={(id) => set({ author: id ?? 0 })}
                  allowNone
                  noneLabel="Semua penulis"
                  placeholder="Semua penulis"
                />
              </div>
            ) : null}
          </DataTableToolbar>
        }
      />
    </div>
  );
}
