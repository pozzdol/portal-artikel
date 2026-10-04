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
import { useResetUserPassword } from '@/lib/api/admin/users';
import type { UserItem } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { password } from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';

const schema = z.object({ new_password: password });

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserItem | null;
}) {
  const reset = useResetUserPassword();
  const form = useZodForm(schema, { defaultValues: { new_password: '' } });

  useEffect(() => {
    if (open) form.reset({ new_password: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await reset.mutateAsync({
        id: user.id,
        newPassword: values.new_password,
      });
      toast.success(`Kata sandi ${user.display_name} direset.`);
      onOpenChange(false);
    } catch (err) {
      applyServerErrors(form, err);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !reset.isPending && onOpenChange(next)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset kata sandi</DialogTitle>
          <DialogDescription>
            {user
              ? `Tetapkan kata sandi baru untuk ${user.display_name}. Semua sesi masuk pengguna ini akan dikeluarkan.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <form
          method="post"
          onSubmit={onSubmit}
          noValidate
          id="reset-password-form"
        >
          <FieldGroup>
            <Controller
              control={form.control}
              name="new_password"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="reset-new-password">
                    Kata sandi baru
                  </FieldLabel>
                  <Input
                    {...field}
                    id="reset-new-password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>Minimal 10 karakter.</FieldDescription>
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
            disabled={reset.isPending}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="submit"
            form="reset-password-form"
            disabled={reset.isPending}
          >
            {reset.isPending ? <Spinner /> : null}
            Reset kata sandi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
