'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Textarea } from '@/components/ui/shadcn/textarea';
import {
  usePermissions,
  useCreateRole,
  useUpdateRole,
} from '@/lib/api/admin/roles';
import type { Role } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { optionalText, requiredText } from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';

import { RoleMatrix } from './RoleMatrix';

const CODE_RE = /^[a-z][a-z0-9_]*$/;

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Wajib diisi.')
    .max(60, 'Maksimal 60 karakter.')
    .regex(
      CODE_RE,
      'Diawali huruf kecil, hanya huruf kecil, angka, atau garis bawah.',
    ),
  name: requiredText(120),
  description: optionalText(500),
  permission_codes: z.array(z.string()),
});

function defaultsFrom(role?: Role | null) {
  return {
    code: role?.code ?? '',
    name: role?.name ?? '',
    description: role?.description ?? '',
    permission_codes: role?.permissions ?? [],
  };
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create a new role. */
  role?: Role | null;
}) {
  const isEdit = !!role;
  const { data: permissions, isLoading: permsLoading } = usePermissions();
  const create = useCreateRole();
  const update = useUpdateRole();
  const form = useZodForm(schema, { defaultValues: defaultsFrom(role) });
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) form.reset(defaultsFrom(role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: role.id,
          input: {
            name: values.name,
            description: values.description,
            permission_codes: values.permission_codes,
          },
        });
        toast.success('Role diperbarui.');
      } else {
        await create.mutateAsync(values);
        toast.success('Role dibuat.');
      }
      onOpenChange(false);
    } catch (err) {
      applyServerErrors(form, err, { knownFields: ['permission_codes'] });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Sunting role' : 'Buat role baru'}
          </DialogTitle>
          <DialogDescription>
            Tetapkan izin per bagian. Perubahan berlaku untuk semua pengguna
            yang memegang role ini.
          </DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={onSubmit} noValidate id="role-form">
          <FieldGroup className="gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="code"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="role-code">Kode</FieldLabel>
                    <Input
                      {...field}
                      id="role-code"
                      disabled={isEdit}
                      placeholder="mis. editor"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>
                      {isEdit
                        ? 'Kode tidak dapat diubah setelah dibuat.'
                        : 'huruf kecil, angka, garis bawah; tidak dapat diubah setelahnya.'}
                    </FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="role-name">Nama</FieldLabel>
                    <Input
                      {...field}
                      id="role-name"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="role-description">Deskripsi</FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    id="role-description"
                    rows={2}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="permission_codes"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Izin</FieldLabel>
                  <RoleMatrix
                    permissions={permissions ?? []}
                    value={field.value}
                    onChange={field.onChange}
                    isLoading={permsLoading}
                  />
                </Field>
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
          <Button type="submit" form="role-form" disabled={pending}>
            {pending ? <Spinner /> : null}
            {isEdit ? 'Simpan' : 'Buat role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
