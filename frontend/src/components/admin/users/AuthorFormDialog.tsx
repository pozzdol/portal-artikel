'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { MediaField } from '@/components/admin/MediaField';
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
import { Textarea } from '@/components/ui/shadcn/textarea';
import { useCreateUser, useUpdateUser } from '@/lib/api/admin/users';
import type { UserDetail } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { mediaId, optionalText, requiredText } from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';

const schema = z.object({
  display_name: requiredText(120),
  title: optionalText(120),
  bio: optionalText(2000),
  avatar_media_id: mediaId,
});

function defaultsFrom(user?: UserDetail | null) {
  return {
    display_name: user?.display_name ?? '',
    title: user?.title ?? '',
    bio: user?.bio ?? '',
    avatar_media_id: user?.avatar_media_id ?? null,
  };
}

export type AuthorFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create a new author. */
  user?: UserDetail | null;
};

/** Non-login author (docs 07 §3.12): `can_login` is always false. */
export function AuthorFormDialog({
  open,
  onOpenChange,
  user,
}: AuthorFormDialogProps) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const isEdit = !!user;
  const form = useZodForm(schema, { defaultValues: defaultsFrom(user) });
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) form.reset(defaultsFrom(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync({ id: user.id, input: values });
        toast.success('Penulis diperbarui.');
      } else {
        await create.mutateAsync({ ...values, can_login: false });
        toast.success('Penulis ditambahkan.');
      }
      onOpenChange(false);
    } catch (err) {
      applyServerErrors(form, err);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Sunting penulis' : 'Tambah penulis'}
          </DialogTitle>
          <DialogDescription>
            Penulis tidak dapat masuk ke panel admin. Gunakan &quot;Jadikan
            pengguna admin&quot; untuk memberi akses login.
          </DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={onSubmit} noValidate id="author-form">
          <FieldGroup className="gap-5">
            <Controller
              control={form.control}
              name="avatar_media_id"
              render={({ field, fieldState }) => (
                <MediaField
                  label="Foto"
                  aspect="1/1"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="display_name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="author-name">Nama tampil</FieldLabel>
                  <Input
                    {...field}
                    id="author-name"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="title"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="author-title">
                    Gelar atau jabatan
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    id="author-title"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="bio"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="author-bio">Bio singkat</FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    id="author-bio"
                    rows={4}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
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
          <Button type="submit" form="author-form" disabled={pending}>
            {pending ? <Spinner /> : null}
            {isEdit ? 'Simpan' : 'Tambah penulis'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
