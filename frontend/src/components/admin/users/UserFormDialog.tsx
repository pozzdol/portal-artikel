'use client';

import { useEffect, useMemo } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { usePermission } from '@/components/admin/shell/PermissionGate';
import { Button } from '@/components/ui/shadcn/button';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { useCreateUser, useUpdateUser } from '@/lib/api/admin/users';
import type { UserDetail } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { MSG, requiredText } from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';
import { normalizePhone } from '@/lib/phone';

import { RoleChecklist } from './RoleChecklist';

export type UserFormMode = 'create' | 'edit' | 'convert';

const IDENTITY_MSG =
  'Isi email atau nomor HP untuk pengguna dengan akses login.';

function buildSchema(requirePassword: boolean, requireIdentity: boolean) {
  const base = z.object({
    display_name: requiredText(120),
    email: z
      .string()
      .trim()
      .max(254, MSG.maxChars(254))
      .refine(
        (v) => v === '' || z.string().email().safeParse(v).success,
        MSG.email,
      ),
    phone: z
      .string()
      .trim()
      .max(32, MSG.maxChars(32))
      .refine(
        (v) => v === '' || normalizePhone(v) !== null,
        'Format nomor HP tidak valid. Contoh: 0821xxxxxxxx.',
      ),
    password: requirePassword
      ? z.string().trim().min(10, MSG.minChars(10)).max(128, MSG.maxChars(128))
      : z.string().trim().max(128, MSG.maxChars(128)).optional(),
    must_change_password: z.boolean(),
    role_ids: z.array(z.number()),
  });
  if (!requireIdentity) return base;
  return base.refine((v) => !!v.email || v.phone !== '', {
    path: ['email'],
    message: IDENTITY_MSG,
  });
}

function defaultsFrom(user?: UserDetail | null) {
  return {
    display_name: user?.display_name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    password: '',
    must_change_password: true,
    role_ids: user?.roles.map((r) => r.id) ?? [],
  };
}

const COPY: Record<
  UserFormMode,
  { title: string; description: string; submit: string }
> = {
  create: {
    title: 'Tambah pengguna admin',
    description: 'Beri akses masuk ke panel admin dan tetapkan role.',
    submit: 'Tambah pengguna',
  },
  edit: {
    title: 'Sunting pengguna',
    description: 'Ubah nama tampil, email, nomor HP, dan role pengguna ini.',
    submit: 'Simpan',
  },
  convert: {
    title: 'Jadikan pengguna admin',
    description:
      'Aktifkan akses login untuk penulis ini dengan email atau nomor HP dan kata sandi sementara.',
    submit: 'Aktifkan akses login',
  },
};

export type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: UserFormMode;
  /** Required for `edit`/`convert`. */
  user?: UserDetail | null;
};

/** Login-capable admin user: create, edit, or convert-from-author (docs 07 §3.12). */
export function UserFormDialog({
  open,
  onOpenChange,
  mode,
  user,
}: UserFormDialogProps) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const canListRoles = usePermission('roles.manage');
  const schema = useMemo(
    () => buildSchema(mode !== 'edit', mode !== 'edit' || !!user?.can_login),
    [mode, user?.can_login],
  );
  const form = useZodForm(schema, { defaultValues: defaultsFrom(user) });
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) form.reset(defaultsFrom(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const role_ids = canListRoles ? values.role_ids : undefined;
      if (mode === 'create') {
        await create.mutateAsync({
          display_name: values.display_name,
          email: values.email || null,
          phone: values.phone || null,
          password: values.password,
          must_change_password: values.must_change_password,
          can_login: true,
          role_ids,
        });
        toast.success('Pengguna admin ditambahkan.');
      } else if (mode === 'convert') {
        await update.mutateAsync({
          id: user!.id,
          input: {
            display_name: values.display_name,
            email: values.email || null,
            phone: values.phone || null,
            password: values.password,
            must_change_password: values.must_change_password,
            can_login: true,
            role_ids,
          },
        });
        toast.success('Penulis kini dapat masuk sebagai admin.');
      } else {
        await update.mutateAsync({
          id: user!.id,
          input: {
            display_name: values.display_name,
            email: values.email || null,
            phone: values.phone || null,
            role_ids,
          },
        });
        toast.success('Pengguna diperbarui.');
      }
      onOpenChange(false);
    } catch (err) {
      applyServerErrors(form, err, { knownFields: ['role_ids'] });
    }
  });

  const copy = COPY[mode];

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={onSubmit} noValidate id="user-form">
          <FieldGroup className="gap-5">
            <Controller
              control={form.control}
              name="display_name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-name">Nama tampil</FieldLabel>
                  <Input
                    {...field}
                    id="user-name"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="user-email"
                    type="email"
                    autoComplete="off"
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
                  <FieldLabel htmlFor="user-phone">Nomor HP</FieldLabel>
                  <Input
                    {...field}
                    id="user-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="0821…"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Disimpan sebagai +62; boleh ditulis 0821…, 62…, atau +62…
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            {mode !== 'edit' ? (
              <Controller
                control={form.control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="user-password">
                      Kata sandi sementara
                    </FieldLabel>
                    <Input
                      {...field}
                      id="user-password"
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>Minimal 10 karakter.</FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ) : null}
            {mode !== 'edit' ? (
              <Controller
                control={form.control}
                name="must_change_password"
                render={({ field }) => (
                  <Field
                    orientation="horizontal"
                    className="min-h-11 items-center gap-3"
                  >
                    <Checkbox
                      id="user-must-change"
                      className="size-5"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      onBlur={field.onBlur}
                    />
                    <FieldLabel
                      htmlFor="user-must-change"
                      className="min-h-11 flex-1 items-center font-normal"
                    >
                      Wajib ganti kata sandi saat login pertama
                    </FieldLabel>
                  </Field>
                )}
              />
            ) : null}
            <Controller
              control={form.control}
              name="role_ids"
              render={({ field }) => (
                <RoleChecklist value={field.value} onChange={field.onChange} />
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button type="submit" form="user-form" disabled={pending}>
            {pending ? <Spinner /> : null}
            {copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
