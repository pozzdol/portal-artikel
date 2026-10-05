'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';

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

import { footerSchema, type FooterValues } from './schemas';

const EMPTY: FooterValues = { description: '', copyright: '' };

export function FooterTab({
  value,
}: {
  value: AdminSettings['site.footer'] | undefined;
}) {
  const update = useUpdateSetting<'site.footer'>();
  const form = useZodForm(footerSchema, { defaultValues: value ?? EMPTY });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(value ?? EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({
        key: 'site.footer',
        value: values,
      });
      form.reset(saved.value);
      toast.success('Footer disimpan.');
    } catch (err) {
      applyServerErrors(form, err);
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FieldGroup className="max-w-2xl gap-6">
        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="footer-description">Deskripsi</FieldLabel>
              <Textarea
                {...field}
                id="footer-description"
                rows={4}
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                Ditampilkan di footer situs publik, di bawah logo. Maksimal
                2.000 karakter.
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="copyright"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="footer-copyright">Copyright</FieldLabel>
              <Input
                {...field}
                id="footer-copyright"
                placeholder="© {year} ALMAIDAH. Seluruh hak cipta dilindungi."
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                Gunakan{' '}
                <code className="bg-muted rounded-sm px-1">{'{year}'}</code>{' '}
                untuk menyisipkan tahun berjalan secara otomatis.
              </FieldDescription>
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
            Simpan footer
          </Button>
        </FormActions>
      </FieldGroup>
    </form>
  );
}
