'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';

import { MediaField } from '@/components/admin/MediaField';
import { Button } from '@/components/ui/shadcn/button';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { useUpdateSetting } from '@/lib/api/admin/settings';
import type { AdminSettings } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { useZodForm } from '@/lib/forms/useZodForm';

import { identitySchema, type IdentityValues } from './schemas';

const EMPTY: IdentityValues = {
  name: '',
  tagline: '',
  logo_media_id: null,
  favicon_media_id: null,
};

export function IdentityTab({
  value,
}: {
  value: AdminSettings['site.identity'] | undefined;
}) {
  const update = useUpdateSetting<'site.identity'>();
  const defaults = value ?? EMPTY;
  const form = useZodForm(identitySchema, { defaultValues: defaults });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(value ?? EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({
        key: 'site.identity',
        value: values,
      });
      form.reset(saved.value);
      toast.success('Identitas situs disimpan.');
    } catch (err) {
      applyServerErrors(form, err);
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="identity-name">Nama situs</FieldLabel>
                <Input
                  {...field}
                  id="identity-name"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="tagline"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="identity-tagline">Tagline</FieldLabel>
                <Input
                  {...field}
                  id="identity-tagline"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="logo_media_id"
            render={({ field, fieldState }) => (
              <MediaField
                label="Logo"
                aspect="4/3"
                value={field.value}
                onChange={(v) => field.onChange(v)}
                error={fieldState.error?.message}
                description="Ditampilkan di header situs publik dan panel admin."
              />
            )}
          />
          <Controller
            control={form.control}
            name="favicon_media_id"
            render={({ field, fieldState }) => (
              <MediaField
                label="Favicon"
                aspect="1/1"
                value={field.value}
                onChange={(v) => field.onChange(v)}
                error={fieldState.error?.message}
                description="Ikon tab peramban, idealnya persegi."
              />
            )}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || update.isPending}
            onClick={() => form.reset(value ?? EMPTY)}
          >
            Batalkan
          </Button>
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? <Spinner /> : null}
            Simpan identitas
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
