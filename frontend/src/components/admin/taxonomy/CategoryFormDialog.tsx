'use client';

import { useEffect } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { CategorySelect } from '@/components/admin/CategorySelect';
import { SeoFields } from '@/components/admin/SeoFields';
import { SlugField } from '@/components/admin/SlugField';
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Switch } from '@/components/ui/shadcn/switch';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { useCreateCategory, useUpdateCategory } from '@/lib/api/admin/taxonomy';
import type { CategoryTreeNode } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import {
  optionalSlug,
  optionalText,
  requiredText,
  seoFields,
} from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';
import { absoluteUrl } from '@/lib/site-url';

const schema = z.object({
  name: requiredText(80),
  slug: optionalSlug,
  parent_id: z.number().int().positive().nullable(),
  description: optionalText(2000),
  is_active: z.boolean(),
  ...seoFields,
});

type FormInput = z.input<typeof schema>;

function defaultsFor(
  category: CategoryTreeNode | null,
  initialParentId: number | null,
): FormInput {
  if (!category) {
    return {
      name: '',
      slug: '',
      parent_id: initialParentId,
      description: '',
      is_active: true,
      seo_title: '',
      seo_description: '',
    };
  }
  return {
    name: category.name,
    slug: category.slug,
    parent_id: category.parent_id,
    description: category.description ?? '',
    is_active: category.is_active,
    seo_title: category.seo_title ?? '',
    seo_description: category.seo_description ?? '',
  };
}

export type CategoryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create. */
  category: CategoryTreeNode | null;
  /** Root categories offered as "induk" (already stripped of children/self). */
  parentOptions: CategoryTreeNode[];
  /** Preset parent when opened via "+ Tambah subkategori" (create mode only). */
  initialParentId?: number | null;
};

/** Create/edit dialog for one category: name, slug, induk, deskripsi, aktif, SEO. */
export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  parentOptions,
  initialParentId = null,
}: CategoryFormDialogProps) {
  const isEdit = !!category;
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(schema, {
    defaultValues: defaultsFor(category, initialParentId),
  });

  useEffect(() => {
    if (open) form.reset(defaultsFor(category, initialParentId));
    // Re-seed only when the dialog (re)opens for a (possibly different) category.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const name = useWatch({ control: form.control, name: 'name' });
  const slug = useWatch({ control: form.control, name: 'slug' });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (category) {
        await update.mutateAsync({ id: category.id, input: values });
        toast.success('Kategori disimpan.');
      } else {
        await create.mutateAsync(values);
        toast.success('Kategori dibuat.');
      }
      onOpenChange(false);
    } catch (err) {
      applyServerErrors(form, err, {
        knownFields: ['parent_id', 'name', 'slug', 'description'],
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? 'Sunting kategori' : 'Kategori baru'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Perbarui detail kategori "${category.name}".`
              : 'Kelompokkan artikel di bawah kategori baru.'}
          </DialogDescription>
        </DialogHeader>
        <form
          method="post"
          onSubmit={onSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1"
        >
          <FieldGroup className="gap-4">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="cat-name">Nama</FieldLabel>
                  <Input
                    {...field}
                    id="cat-name"
                    aria-invalid={fieldState.invalid}
                    autoFocus
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="slug"
              render={({ field, fieldState }) => (
                <SlugField
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  sourceValue={name ?? ''}
                  autoFrom="nama"
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="parent_id"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="cat-parent">Induk</FieldLabel>
                  <CategorySelect
                    id="cat-parent"
                    value={field.value}
                    onChange={field.onChange}
                    tree={parentOptions}
                    allowNone
                    noneLabel="Tanpa induk (kategori level 1)"
                  />
                  <FieldDescription>
                    Kategori hanya boleh 2 level.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="cat-desc">Deskripsi</FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    id="cat-desc"
                    rows={3}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="cat-active">Aktif</FieldLabel>
                    <FieldDescription>
                      Kategori nonaktif disembunyikan dari situs publik.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="cat-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              )}
            />
            <SeoFields
              form={form}
              previewUrlBase={absoluteUrl(`/${slug || 'kategori'}`)}
              fallbackTitle={name}
            />
          </FieldGroup>
          <DialogFooter className="border-line -mx-1 border-t px-1 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="gold" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {isEdit ? 'Simpan' : 'Buat kategori'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
