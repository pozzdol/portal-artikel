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
import { Switch } from '@/components/ui/shadcn/switch';
import { useUpdateSetting } from '@/lib/api/admin/settings';
import type { AdminSettings } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { useZodForm } from '@/lib/forms/useZodForm';

import { headerOptionsSchema, type HeaderOptionsValues } from './schemas';

const EMPTY: HeaderOptionsValues = {
  show_date: true,
  show_search: true,
  show_theme_toggle: true,
  show_login_button: true,
  login_label: 'Masuk Admin',
};

const SWITCHES: {
  name: keyof Pick<
    HeaderOptionsValues,
    'show_date' | 'show_search' | 'show_theme_toggle' | 'show_login_button'
  >;
  label: string;
  description: string;
}[] = [
  {
    name: 'show_date',
    label: 'Tampilkan tanggal',
    description: 'Tanggal hari ini di bar header.',
  },
  {
    name: 'show_search',
    label: 'Tampilkan pencarian',
    description: 'Ikon/kotak pencarian di header.',
  },
  {
    name: 'show_theme_toggle',
    label: 'Tampilkan tombol tema',
    description: 'Tombol beralih mode terang/gelap.',
  },
  {
    name: 'show_login_button',
    label: 'Tampilkan tombol masuk',
    description: 'Tombol menuju halaman login admin.',
  },
];

export function HeaderTab({
  value,
}: {
  value: AdminSettings['header.options'] | undefined;
}) {
  const update = useUpdateSetting<'header.options'>();
  const form = useZodForm(headerOptionsSchema, {
    defaultValues: value ?? EMPTY,
  });
  const { isDirty } = form.formState;
  const showLoginButton = form.watch('show_login_button');

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(value ?? EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({
        key: 'header.options',
        value: values,
      });
      form.reset(saved.value);
      toast.success('Opsi header disimpan.');
    } catch (err) {
      applyServerErrors(form, err);
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FieldGroup className="max-w-2xl gap-5">
        {SWITCHES.map((s) => (
          <Controller
            key={s.name}
            control={form.control}
            name={s.name}
            render={({ field }) => (
              <Field
                orientation="horizontal"
                className="border-line items-center justify-between border py-3"
              >
                <div className="flex flex-col gap-0.5 px-3">
                  <FieldLabel htmlFor={`header-${s.name}`}>
                    {s.label}
                  </FieldLabel>
                  <FieldDescription>{s.description}</FieldDescription>
                </div>
                <Switch
                  id={`header-${s.name}`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mr-3"
                />
              </Field>
            )}
          />
        ))}
        <Controller
          control={form.control}
          name="login_label"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="header-login-label">
                Label tombol masuk
              </FieldLabel>
              <Input
                {...field}
                id="header-login-label"
                disabled={!showLoginButton}
                aria-invalid={fieldState.invalid}
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
            Simpan opsi header
          </Button>
        </FormActions>
      </FieldGroup>
    </form>
  );
}
