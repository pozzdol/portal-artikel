'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';

import { MediaField } from '@/components/admin/MediaField';
import { FormActions } from '@/components/admin/FormActions';
import { Button } from '@/components/ui/shadcn/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { useUpdateSetting } from '@/lib/api/admin/settings';
import type { AdminSettings } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { useZodForm } from '@/lib/forms/useZodForm';

import { seoSchema, type SeoValues } from './schemas';

const EMPTY: SeoValues = {
  title_template: '%s | ALMAIDAH',
  default_description: '',
  default_og_media_id: null,
  google_site_verification: '',
};

export function SeoTab({
  value,
}: {
  value: AdminSettings['seo.defaults'] | undefined;
}) {
  const update = useUpdateSetting<'seo.defaults'>();
  const form = useZodForm(seoSchema, { defaultValues: value ?? EMPTY });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(value ?? EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({
        key: 'seo.defaults',
        value: values,
      });
      form.reset(saved.value);
      toast.success('Pengaturan SEO disimpan.');
    } catch (err) {
      applyServerErrors(form, err);
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FieldGroup className="max-w-2xl gap-6">
        <Controller
          control={form.control}
          name="title_template"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="seo-title-template">
                Template judul
              </FieldLabel>
              <Input
                {...field}
                id="seo-title-template"
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                Wajib memuat{' '}
                <code className="bg-muted rounded-sm px-1">%s</code>, yang
                diganti dengan judul tiap halaman. Mis. &quot;%s |
                ALMAIDAH&quot;.
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="default_description"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="seo-default-description">
                Deskripsi default
              </FieldLabel>
              <Textarea
                {...field}
                id="seo-default-description"
                rows={3}
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                Dipakai bila halaman tidak memiliki deskripsi SEO sendiri.
                Maksimal 300 karakter.
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="default_og_media_id"
          render={({ field, fieldState }) => (
            <MediaField
              label="Gambar OG default"
              aspect="16/9"
              value={field.value}
              onChange={(v) => field.onChange(v)}
              error={fieldState.error?.message}
              description="Dipakai saat sebuah halaman/artikel tidak memiliki gambar OG sendiri."
            />
          )}
        />
        <Controller
          control={form.control}
          name="google_site_verification"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="seo-google-verification">
                Kode verifikasi Google
              </FieldLabel>
              <Input
                {...field}
                id="seo-google-verification"
                aria-invalid={fieldState.invalid}
                placeholder="Isi nilai meta tag google-site-verification"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <FormActions>
          {isDirty ? (
            <p className="text-muted-foreground mr-auto text-sm">
              Ada perubahan belum disimpan.
            </p>
          ) : null}
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
            Simpan SEO
          </Button>
        </FormActions>
      </FieldGroup>
    </form>
  );
}
