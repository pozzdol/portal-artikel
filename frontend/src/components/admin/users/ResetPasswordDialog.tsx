'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { useResetUserPassword } from '@/lib/api/admin/users';
import type { UserItem } from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { password } from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';

const schema = z.object({
  new_password: password,
  must_change_password: z.boolean(),
});

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
  const form = useZodForm(schema, {
    defaultValues: { new_password: '', must_change_password: true },
  });

  useEffect(() => {
    if (open) form.reset({ new_password: '', must_change_password: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await reset.mutateAsync({
        id: user.id,
        input: {
          new_password: values.new_password,
          must_change_password: values.must_change_password,
        },
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
            <Controller
              control={form.control}
              name="must_change_password"
              render={({ field }) => (
                <Field
                  orientation="horizontal"
                  className="min-h-11 items-center gap-3"
                >
                  <Checkbox
                    id="reset-must-change"
                    className="size-5"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    onBlur={field.onBlur}
                  />
                  <FieldLabel
                    htmlFor="reset-must-change"
                    className="min-h-11 flex-1 items-center font-normal"
                  >
                    Wajib ganti kata sandi saat login pertama
                  </FieldLabel>
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
