'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { MediaField } from '@/components/admin/MediaField';
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
import { useUpdateMe } from '@/lib/api/admin/auth';
import type { Me } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { mediaId, optionalText, requiredText } from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';

const schema = z.object({
  display_name: requiredText(120),
  title: optionalText(120),
  bio: optionalText(2000),
  avatar_media_id: mediaId,
});

function defaultsFrom(me: Me) {
  return {
    display_name: me.display_name,
    title: me.title ?? '',
    bio: me.bio ?? '',
    avatar_media_id: me.avatar_media_id,
  };
}

/** Name, title, bio and photo of the signed-in user (PUT /auth/me, full replace). */
export function ProfileForm({ me }: { me: Me }) {
  const update = useUpdateMe();
  const form = useZodForm(schema, { defaultValues: defaultsFrom(me) });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(defaultsFrom(me));
  }, [me, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync(values);
      form.reset(defaultsFrom(saved));
      toast.success('Profil disimpan.');
    } catch (err) {
      applyServerErrors(form, err);
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-6">
        <div className="grid gap-6 md:grid-cols-[180px_1fr]">
          <Controller
            control={form.control}
            name="avatar_media_id"
            render={({ field, fieldState }) => (
              <MediaField
                label="Foto profil"
                aspect="1/1"
                value={field.value ?? null}
                onChange={(v) => field.onChange(v)}
                error={fieldState.error?.message}
              />
            )}
          />
          <FieldGroup className="gap-5">
            <Controller
              control={form.control}
              name="display_name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="profile-name">Nama tampil</FieldLabel>
                  <Input
                    {...field}
                    id="profile-name"
                    aria-invalid={fieldState.invalid}
                    autoComplete="name"
                  />
                  <FieldDescription>
                    Tampil sebagai nama penulis di artikel.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="title"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="profile-title">
                    Gelar atau jabatan
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    id="profile-title"
                    placeholder="Mis. Redaktur Pelaksana"
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
                  <FieldLabel htmlFor="profile-bio">Bio singkat</FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    id="profile-bio"
                    rows={5}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Muncul di halaman penulis. Maksimal 2.000 karakter.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || update.isPending}
            onClick={() => form.reset(defaultsFrom(me))}
          >
            Batalkan
          </Button>
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? <Spinner /> : null}
            Simpan profil
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
