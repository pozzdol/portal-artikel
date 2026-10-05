'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';

import { FormActions } from '@/components/admin/FormActions';
import { Button } from '@/components/ui/shadcn/button';
import {
  Field,
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

import { contactSchema, type ContactValues } from './schemas';

const EMPTY: ContactValues = { address: '', email: '', phone: '' };

export function ContactTab({
  value,
}: {
  value: AdminSettings['site.contact'] | undefined;
}) {
  const update = useUpdateSetting<'site.contact'>();
  const form = useZodForm(contactSchema, { defaultValues: value ?? EMPTY });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(value ?? EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({
        key: 'site.contact',
        value: values,
      });
      form.reset(saved.value);
      toast.success('Kontak disimpan.');
    } catch (err) {
      applyServerErrors(form, err);
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FieldGroup className="max-w-2xl gap-6">
        <Controller
          control={form.control}
          name="address"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="contact-address">Alamat</FieldLabel>
              <Textarea
                {...field}
                id="contact-address"
                rows={3}
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="contact-email">Email</FieldLabel>
                <Input
                  {...field}
                  id="contact-email"
                  type="email"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="phone"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="contact-phone">Telepon</FieldLabel>
                <Input
                  {...field}
                  id="contact-phone"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>
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
            Simpan kontak
          </Button>
        </FormActions>
      </FieldGroup>
    </form>
  );
}
