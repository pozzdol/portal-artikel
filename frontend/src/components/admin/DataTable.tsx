'use client';

import * as React from 'react';
import {
  createColumnHelper,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/shadcn/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/shadcn/table';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { cn } from '@/lib/cn';
import type { ListMeta } from '@/lib/api/admin/types';

/**
 * Column meta shared by every admin DataTable. `sortKey` is the backend's whitelisted sort
 * field (see docs/05-api.md); its presence makes the header clickable. Sorting/pagination are
 * always manual/server-side here — no TanStack row-sorting/pagination feature is registered.
 */
export type DataTableColumnMeta = {
  sortKey?: string;
  align?: 'left' | 'center' | 'right';
  /** Progressive disclosure for dense tables. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Shrink the column to its content (w-px, no wrapping). */
  compact?: boolean;
};

const features = tableFeatures({ columnMeta: {} as DataTableColumnMeta });

export type DataTableFeatures = typeof features;
/**
 * `TValue` is pinned to `any` (not the `ColumnDef` default of `unknown`): a `columns`
 * array mixes column defs whose inferred `TValue` differs per field (via
 * `createDataTableColumnHelper<T>().accessor(...)`), and `unknown` makes each of those
 * concrete column defs (whose `cell`/`footer` templates take a narrower `CellContext`)
 * unassignable to the union member here — `any` is the one `TValue` every concrete
 * column def structurally satisfies.
 */
export type DataTableColumnDef<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

/** Typed column helper for building `columns` (TanStack Table v9). */
export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

export type DataTableProps<TData extends RowData> = {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  /** Pagination meta; omit for endpoints that return a plain (unpaged) array. */
  meta?: ListMeta;
  isLoading?: boolean;
  /** Current backend sort string, e.g. "-updated_at". */
  sort?: string;
  onSortChange?: (sort: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  toolbar?: React.ReactNode;
  empty?: React.ReactNode;
  getRowId?: (row: TData) => string | number;
  /** Rendered as a trailing, unsortable "actions" column when provided. */
  rowActions?: (row: TData) => React.ReactNode;
  className?: string;
};

function metaOf(def: {
  meta?: DataTableColumnMeta;
}): DataTableColumnMeta | undefined {
  return def.meta;
}

function cellClass(meta: DataTableColumnMeta | undefined): string | undefined {
  const align =
    meta?.align === 'right'
      ? 'text-right'
      : meta?.align === 'center'
        ? 'text-center'
        : undefined;
  const hide =
    meta?.hideBelow === 'sm'
      ? 'hidden sm:table-cell'
      : meta?.hideBelow === 'md'
        ? 'hidden md:table-cell'
        : meta?.hideBelow === 'lg'
          ? 'hidden lg:table-cell'
          : meta?.hideBelow === 'xl'
            ? 'hidden xl:table-cell'
            : undefined;
  return cn(align, hide, meta?.compact && 'w-px whitespace-nowrap');
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  meta,
  isLoading,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbar,
  empty,
  getRowId,
  rowActions,
  className,
}: DataTableProps<TData>) {
  const allColumns = React.useMemo<DataTableColumnDef<TData>[]>(() => {
    if (!rowActions) return columns;
    const helper = createDataTableColumnHelper<TData>();
    return [
      ...columns,
      helper.display({
        id: '__rowActions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">{rowActions(row.original)}</div>
        ),
        meta: { align: 'right' },
      }),
    ];
  }, [columns, rowActions]);

  const table = useTable({
    features,
    columns: allColumns,
    data,
    getRowId: getRowId ? (row) => String(getRowId(row)) : undefined,
  });

  const rows = table.getRowModel().rows;
  const colSpan = allColumns.length;

  function toggleSort(key: string) {
    if (!onSortChange) return;
    onSortChange(sort === key ? `-${key}` : key);
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {toolbar}
      <div className="border-line rounded-none border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const colMeta = metaOf(header.column.columnDef);
                  return (
                    <TableHead key={header.id} className={cellClass(colMeta)}>
                      {header.isPlaceholder ? null : colMeta?.sortKey ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2.5 gap-1 px-2.5 font-medium"
                          onClick={() => toggleSort(colMeta.sortKey as string)}
                        >
                          <table.FlexRender header={header} />
                          {sort === colMeta.sortKey ? (
                            <ArrowUpIcon className="size-3.5" />
                          ) : sort === `-${colMeta.sortKey}` ? (
                            <ArrowDownIcon className="size-3.5" />
                          ) : (
                            <ArrowUpDownIcon className="size-3.5 opacity-40" />
                          )}
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && rows.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {allColumns.map((_, ci) => (
                    <TableCell key={ci}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-40 text-center">
                  {empty ?? (
                    <span className="text-muted-foreground text-sm">
                      Belum ada data.
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(isLoading && 'opacity-60')}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cellClass(metaOf(cell.column.columnDef))}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {meta ? (
        <DataTablePagination
          meta={meta}
          page={page}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  );
}

function getPageWindow(
  page: number,
  totalPages: number,
): (number | 'ellipsis')[] {
  const set = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...set]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}

function DataTablePagination({
  meta,
  page,
  onPageChange,
}: {
  meta: ListMeta;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, meta.total_pages);
  const from = meta.total === 0 ? 0 : (page - 1) * meta.per_page + 1;
  const to = Math.min(meta.total, page * meta.per_page);
  const pages = getPageWindow(page, totalPages);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-muted-foreground text-sm">
        {meta.total === 0
          ? 'Tidak ada data.'
          : `Menampilkan ${from}–${to} dari ${meta.total}.`}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text="Sebelumnya"
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
              className={cn(page <= 1 && 'pointer-events-none opacity-40')}
            />
          </PaginationItem>
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              text="Berikutnya"
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) onPageChange(page + 1);
              }}
              className={cn(
                page >= totalPages && 'pointer-events-none opacity-40',
              )}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
