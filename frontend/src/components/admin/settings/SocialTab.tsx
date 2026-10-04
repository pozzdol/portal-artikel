'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { GripVerticalIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { toast } from 'sonner';

import { SortableList } from '@/components/admin/SortableList';
import { Button } from '@/components/ui/shadcn/button';
import { Field, FieldError, FieldGroup } from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { useUpdateSetting } from '@/lib/api/admin/settings';
import type { AdminSettings, SocialLink } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { useZodForm } from '@/lib/forms/useZodForm';

import { PLATFORM_LABEL, SOCIAL_PLATFORMS, socialSchema } from './schemas';

/** A row keeps a client-only `_key` for drag identity; it never reaches the server (zod
 * strips it, since `socialLinkSchema` doesn't declare it). */
type Row = SocialLink & { _key: string };

function withKeys(links: SocialLink[]): Row[] {
  return links.map((l) => ({ ...l, _key: crypto.randomUUID() }));
}

export function SocialTab({
  value,
}: {
  value: AdminSettings['site.social'] | undefined;
}) {
  const update = useUpdateSetting<'site.social'>();
  const form = useZodForm(socialSchema, {
    defaultValues: { links: withKeys(value ?? []) as SocialLink[] },
  });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!form.formState.isDirty)
      form.reset({ links: withKeys(value ?? []) as SocialLink[] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({
        key: 'site.social',
        value: values.links,
      });
      form.reset({
        links: withKeys(saved.value) as SocialLink[],
      });
      toast.success('Tautan sosial media disimpan.');
    } catch (err) {
      applyServerErrors(form, err, { knownFields: ['links'] });
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FieldGroup className="max-w-2xl gap-6">
        <Controller
          control={form.control}
          name="links"
          render={({ field }) => {
            const rows = field.value as unknown as Row[];
            const rowErrors = form.formState.errors.links;

            function update(key: string, patch: Partial<SocialLink>) {
              field.onChange(
                rows.map((r) => (r._key === key ? { ...r, ...patch } : r)),
              );
            }
            function remove(key: string) {
              field.onChange(rows.filter((r) => r._key !== key));
            }
            function add() {
              field.onChange([
                ...rows,
                { _key: crypto.randomUUID(), platform: 'instagram', url: '' },
              ]);
            }

            return (
              <Field>
                {rows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Belum ada tautan sosial media.
                  </p>
                ) : (
                  <SortableList
                    items={rows}
                    getId={(r) => r._key}
                    onReorder={(next) => field.onChange(next)}
                    renderItem={(row, { handleProps, isDragging }) => {
                      const i = rows.findIndex((r) => r._key === row._key);
                      const err = Array.isArray(rowErrors)
                        ? rowErrors[i]
                        : undefined;
                      return (
                        <div
                          className={
                            'border-line bg-background flex items-start gap-2 border p-2' +
                            (isDragging ? ' shadow-md' : '')
                          }
                        >
                          <button
                            type="button"
                            ref={handleProps.ref}
                            {...handleProps.attributes}
                            {...handleProps.listeners}
                            className="text-muted-foreground mt-1.5 cursor-grab touch-none active:cursor-grabbing"
                            aria-label="Urutkan"
                          >
                            <GripVerticalIcon className="size-4" />
                          </button>
                          <div className="grid flex-1 gap-2 sm:grid-cols-[10rem_1fr]">
                            <Select
                              value={row.platform}
                              onValueChange={(v) =>
                                update(row._key, {
                                  platform: v as SocialLink['platform'],
                                })
                              }
                            >
                              <SelectTrigger aria-label="Platform">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SOCIAL_PLATFORMS.map((p) => (
                                  <SelectItem key={p} value={p}>
                                    {PLATFORM_LABEL[p]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div>
                              <Input
                                value={row.url}
                                onChange={(e) =>
                                  update(row._key, { url: e.target.value })
                                }
                                placeholder="https://…"
                                aria-invalid={!!err?.url}
                              />
                              {err?.url ? (
                                <p className="text-destructive mt-1 text-xs">
                                  {err.url.message}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => remove(row._key)}
                            aria-label="Hapus tautan"
                          >
                            <TrashIcon />
                          </Button>
                        </div>
                      );
                    }}
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={add}
                >
                  <PlusIcon data-icon="inline-start" />
                  Tambah tautan
                </Button>
                <FieldError errors={[form.formState.errors.links?.root]} />
              </Field>
            );
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || update.isPending}
            onClick={() =>
              form.reset({ links: withKeys(value ?? []) as SocialLink[] })
            }
          >
            Batalkan
          </Button>
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? <Spinner /> : null}
            Simpan sosial media
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
