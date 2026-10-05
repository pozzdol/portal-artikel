'use client';

import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { useChangePassword } from '@/lib/api/admin/auth';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { MSG, password } from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';

const schema = z
  .object({
    current_password: z
      .string()
      .min(1, MSG.required)
      .max(128, MSG.maxChars(128)),
    new_password: password,
    confirm_password: z.string().min(1, MSG.required),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ['confirm_password'],
    message: 'Konfirmasi tidak sama dengan kata sandi baru.',
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ['new_password'],
    message: 'Kata sandi baru harus berbeda dari yang sekarang.',
  });

const EMPTY = { current_password: '', new_password: '', confirm_password: '' };

const FIELDS = [
  {
    name: 'current_password',
    label: 'Kata sandi sekarang',
    autoComplete: 'current-password',
  },
  {
    name: 'new_password',
    label: 'Kata sandi baru',
    autoComplete: 'new-password',
    description: 'Minimal 10 karakter.',
  },
  {
    name: 'confirm_password',
    label: 'Ulangi kata sandi baru',
    autoComplete: 'new-password',
  },
] as const;

export type PasswordFormProps = {
  /** Runs after a successful change instead of the default toast. */
  onSuccess?: () => void | Promise<void>;
  submitLabel?: string;
  autoFocus?: boolean;
  successMessage?: string;
};

/** PUT /auth/me/password; other sessions are signed out by the server. */
export function PasswordForm({
  onSuccess,
  submitLabel = 'Ganti kata sandi',
  autoFocus = false,
  successMessage = 'Kata sandi diganti. Sesi di perangkat lain telah dikeluarkan.',
}: PasswordFormProps = {}) {
  const change = useChangePassword();
  const form = useZodForm(schema, { defaultValues: EMPTY });

  const onSubmit = form.handleSubmit(
    async ({ current_password, new_password }) => {
      try {
        await change.mutateAsync({ current_password, new_password });
        form.reset(EMPTY);
        toast.success(successMessage);
        await onSuccess?.();
      } catch (err) {
        applyServerErrors(form, err);
      }
    },
  );

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="max-w-md">
      <FieldGroup className="gap-5">
        {FIELDS.map((f, i) => (
          <Controller
            key={f.name}
            control={form.control}
            name={f.name}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`pw-${f.name}`}>{f.label}</FieldLabel>
                <Input
                  {...field}
                  id={`pw-${f.name}`}
                  type="password"
                  autoFocus={autoFocus && i === 0}
                  autoComplete={f.autoComplete}
                  aria-invalid={fieldState.invalid}
                />
                {'description' in f ? (
                  <FieldDescription>{f.description}</FieldDescription>
                ) : null}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ))}
        <div>
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? <Spinner /> : null}
            {submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
