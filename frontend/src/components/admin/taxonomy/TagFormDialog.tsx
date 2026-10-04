'use client';

import { useEffect } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { useCreateTag, useUpdateTag } from '@/lib/api/admin/taxonomy';
import type { Tag } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { optionalSlug, requiredText } from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';

const schema = z.object({
  name: requiredText(60),
  slug: optionalSlug,
});

type FormInput = z.input<typeof schema>;

function defaultsFor(tag: Tag | null): FormInput {
  return { name: tag?.name ?? '', slug: tag?.slug ?? '' };
}

export type TagFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create. */
  tag: Tag | null;
};

/** Create/edit dialog for one tag: name and slug (docs 07 §3.5 — merge/delete live elsewhere). */
export function TagFormDialog({ open, onOpenChange, tag }: TagFormDialogProps) {
  const isEdit = !!tag;
  const create = useCreateTag();
  const update = useUpdateTag();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(schema, { defaultValues: defaultsFor(tag) });

  useEffect(() => {
    if (open) form.reset(defaultsFor(tag));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tag]);

  const name = useWatch({ control: form.control, name: 'name' });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (tag) {
        await update.mutateAsync({ id: tag.id, input: values });
        toast.success('Tag disimpan.');
      } else {
        await create.mutateAsync(values);
        toast.success('Tag dibuat.');
      }
      onOpenChange(false);
    } catch (err) {
      applyServerErrors(form, err, { knownFields: ['name', 'slug'] });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? 'Sunting tag' : 'Tag baru'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Perbarui detail tag "${tag.name}".`
              : 'Tambahkan tag baru untuk menandai artikel.'}
          </DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="tag-name">Nama</FieldLabel>
                  <Input
                    {...field}
                    id="tag-name"
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
          </FieldGroup>
          <DialogFooter className="mt-6">
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
              {isEdit ? 'Simpan' : 'Buat tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
