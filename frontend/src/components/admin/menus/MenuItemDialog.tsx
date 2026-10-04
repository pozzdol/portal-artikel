'use client';

import * as React from 'react';
import { Controller } from 'react-hook-form';
import { z } from 'zod';

import { CategoryCombobox } from '@/components/admin/CategoryCombobox';
import { PageSelect } from '@/components/admin/PageSelect';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/shadcn/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Switch } from '@/components/ui/shadcn/switch';
import { usePublicCategoryTree } from '@/lib/api/admin/taxonomy';
import { usePages } from '@/lib/api/admin/pages';
import { MSG, requiredText } from '@/lib/forms/schemas';
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges';
import { useZodForm } from '@/lib/forms/useZodForm';
import type { MenuLinkType } from '@/lib/api/admin/types';

import {
  computeHrefPreview,
  LINK_TYPE_LABEL,
  ROUTE_OPTIONS,
  type MenuNodeData,
} from './tree';

const LABEL_MAX = 80;
const TARGET_MAX = 300;
const ANCHOR_RE = /^[a-z0-9-]+$/i;
const URL_RE = /^(https?:\/\/|\/)/;

const menuItemSchema = z
  .object({
    label: requiredText(LABEL_MAX),
    link_type: z.enum(['url', 'route', 'category', 'page', 'anchor']),
    link_target: z.string().trim().max(TARGET_MAX, MSG.maxChars(TARGET_MAX)),
    open_new_tab: z.boolean(),
    is_active: z.boolean(),
  })
  .superRefine((val, ctx) => {
    const target = val.link_target.trim();
    if (val.link_type === 'url') {
      if (!target) {
        ctx.addIssue({
          code: 'custom',
          path: ['link_target'],
          message: MSG.required,
        });
      } else if (!URL_RE.test(target)) {
        ctx.addIssue({
          code: 'custom',
          path: ['link_target'],
          message: 'URL harus diawali http://, https://, atau /.',
        });
      }
    } else if (val.link_type === 'route') {
      if (!ROUTE_OPTIONS.some((r) => r.value === target)) {
        ctx.addIssue({
          code: 'custom',
          path: ['link_target'],
          message: MSG.required,
        });
      }
    } else if (val.link_type === 'anchor') {
      if (!target) {
        ctx.addIssue({
          code: 'custom',
          path: ['link_target'],
          message: MSG.required,
        });
      } else if (!ANCHOR_RE.test(target)) {
        ctx.addIssue({
          code: 'custom',
          path: ['link_target'],
          message: 'Hanya huruf, angka, dan tanda hubung.',
        });
      }
    } else if (!target) {
      ctx.addIssue({
        code: 'custom',
        path: ['link_target'],
        message: MSG.required,
      });
    }
  });

type FormValues = z.infer<typeof menuItemSchema>;

export type MenuItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new item. */
  initial: MenuNodeData | null;
  title: string;
  onSubmit: (values: Omit<MenuNodeData, 'id'>) => void;
};

/** Add/edit dialog for one menu item; nothing here calls the API — the
 * caller folds the result into the working tree, saved as a whole by
 * PUT /menus/{code}/items (docs/07 §3.10). */
export function MenuItemDialog({
  open,
  onOpenChange,
  initial,
  title,
  onSubmit,
}: MenuItemDialogProps) {
  const { data: categoryTree } = usePublicCategoryTree();
  const { data: pages } = usePages();
  const publishedPageSlugs = React.useMemo(
    () =>
      (pages ?? []).filter((p) => p.status === 'published').map((p) => p.slug),
    [pages],
  );

  const form = useZodForm(menuItemSchema, {
    defaultValues: {
      label: initial?.label ?? '',
      link_type: initial?.link_type ?? 'url',
      link_target: initial?.link_target ?? '',
      open_new_tab: initial?.open_new_tab ?? false,
      is_active: initial?.is_active ?? true,
    },
  });
  const { confirmLeave } = useUnsavedChanges(form.formState.isDirty);

  const linkType = form.watch('link_type');
  const linkTarget = form.watch('link_target');
  const preview = computeHrefPreview(
    linkType as MenuLinkType,
    linkTarget,
    categoryTree ?? [],
    publishedPageSlugs,
  );

  const submit = form.handleSubmit((values: FormValues) => {
    onSubmit({
      label: values.label,
      link_type: values.link_type,
      link_target: values.link_target.trim(),
      open_new_tab: values.open_new_tab,
      is_active: values.is_active,
    });
    onOpenChange(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !confirmLeave()) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pilih tipe tautan, lalu tentukan tujuannya.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.label}>
              <FieldLabel htmlFor="menu-item-label">Label</FieldLabel>
              <Input
                id="menu-item-label"
                aria-invalid={!!form.formState.errors.label}
                {...form.register('label')}
              />
              <FieldError errors={[form.formState.errors.label]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="menu-item-type">Tipe tautan</FieldLabel>
              <Controller
                control={form.control}
                name="link_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v as MenuLinkType);
                      form.setValue('link_target', '', { shouldDirty: true });
                    }}
                  >
                    <SelectTrigger id="menu-item-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LINK_TYPE_LABEL) as MenuLinkType[]).map(
                        (lt) => (
                          <SelectItem key={lt} value={lt}>
                            {LINK_TYPE_LABEL[lt]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field data-invalid={!!form.formState.errors.link_target}>
              <FieldLabel htmlFor="menu-item-target">Tujuan</FieldLabel>
              <Controller
                control={form.control}
                name="link_target"
                render={({ field }) => {
                  if (linkType === 'route') {
                    return (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="menu-item-target" className="w-full">
                          <SelectValue placeholder="Pilih rute…" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROUTE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }
                  if (linkType === 'category') {
                    return (
                      <CategoryCombobox
                        id="menu-item-target"
                        value={field.value || null}
                        onChange={(v) => field.onChange(v ?? '')}
                        allowClear={false}
                      />
                    );
                  }
                  if (linkType === 'page') {
                    return (
                      <PageSelect
                        id="menu-item-target"
                        value={field.value || null}
                        onChange={(v) => field.onChange(v ?? '')}
                      />
                    );
                  }
                  if (linkType === 'anchor') {
                    return (
                      <InputGroup>
                        <InputGroupAddon>#</InputGroupAddon>
                        <InputGroupInput
                          id="menu-item-target"
                          placeholder="kajian"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          aria-invalid={!!form.formState.errors.link_target}
                        />
                      </InputGroup>
                    );
                  }
                  return (
                    <Input
                      id="menu-item-target"
                      placeholder="/artikel/... atau https://…"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      aria-invalid={!!form.formState.errors.link_target}
                    />
                  );
                }}
              />
              <FieldError errors={[form.formState.errors.link_target]} />
              <p className="text-muted-foreground text-xs">
                Pratinjau tautan:{' '}
                <code className="text-foreground">
                  {preview ?? '— tidak dapat diselesaikan —'}
                </code>
              </p>
            </Field>

            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="open_new_tab"
                render={({ field }) => (
                  <Switch
                    id="menu-item-newtab"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldLabel htmlFor="menu-item-newtab" className="font-normal">
                Buka di tab baru
              </FieldLabel>
            </Field>

            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <Switch
                    id="menu-item-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldLabel htmlFor="menu-item-active" className="font-normal">
                Aktif
              </FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (confirmLeave()) onOpenChange(false);
              }}
            >
              Batal
            </Button>
            <Button type="submit">Simpan item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
