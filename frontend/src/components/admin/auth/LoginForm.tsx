'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { AlertCircleIcon, EyeIcon, EyeOffIcon } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/shadcn/alert';
import { Button } from '@/components/ui/shadcn/button';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/shadcn/input-group';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { useLogin } from '@/lib/api/admin/auth';
import { isApiClientError, refreshSession } from '@/lib/api/client';
import { apiErrorMessage, applyServerErrors } from '@/lib/forms/serverErrors';
import { email, MSG } from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';

const schema = z.object({
  email,
  password: z.string().min(1, MSG.required),
  remember: z.boolean(),
});

const INVALID_CREDENTIALS = 'Email atau kata sandi salah.';

const noopSubscribe = () => () => {};

/**
 * False in the server HTML and until React hydrates. Until then the submit
 * button stays disabled, so an early click can never fall back to a native
 * form POST that sends the credentials to the page itself.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Epoch ms `seconds` from now (at least 1s). */
function deadlineIn(seconds: number | undefined): number {
  return Date.now() + Math.max(1, seconds ?? 60) * 1000;
}

export type LoginFormProps = {
  /** Already-sanitized redirect target (see safeNext). */
  next: string;
  /**
   * The server saw an access cookie it could not verify (expired): try one
   * silent refresh on mount and skip the form if it succeeds.
   */
  tryRefresh?: boolean;
};

export function LoginForm({ next, tryRefresh = false }: LoginFormProps) {
  const router = useRouter();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const refreshTried = useRef(false);
  const hydrated = useHydrated();

  const form = useZodForm(schema, {
    defaultValues: { email: '', password: '', remember: false },
  });

  useEffect(() => {
    if (!tryRefresh || refreshTried.current) return;
    refreshTried.current = true;
    void refreshSession().then((ok) => {
      if (ok) {
        setRedirecting(true);
        router.replace(next);
      }
    });
  }, [tryRefresh, next, router]);

  useEffect(() => {
    if (lockedUntil === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        setLockedUntil(null);
        setFormError(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const locked = lockedUntil !== null && secondsLeft > 0;
  const busy = login.isPending || redirecting;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login.mutateAsync(values);
      setRedirecting(true);
      router.replace(next);
    } catch (err) {
      form.resetField('password', { defaultValue: '' });
      if (isApiClientError(err)) {
        if (err.status === 401) {
          setFormError(INVALID_CREDENTIALS);
          return;
        }
        if (err.status === 429) {
          setLockedUntil(deadlineIn(err.retryAfter));
          return;
        }
        if (err.status === 422 && err.fields) {
          applyServerErrors(form, err, { notify: (m) => setFormError(m) });
          return;
        }
      }
      setFormError(apiErrorMessage(err));
    }
  });

  const message = locked
    ? `Terlalu banyak percobaan, coba lagi dalam ${secondsLeft} detik.`
    : formError;

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      aria-describedby={message ? 'login-error' : undefined}
    >
      <FieldGroup className="gap-5">
        {message ? (
          <Alert variant="destructive" id="login-error" aria-live="polite">
            <AlertCircleIcon />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">Email</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoFocus
                spellCheck={false}
                className="h-10"
                aria-invalid={fieldState.invalid}
                disabled={busy}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">Kata sandi</FieldLabel>
              <InputGroup className="h-10">
                <InputGroupInput
                  {...field}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                  disabled={busy}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    className="size-9 md:size-7"
                    aria-label={
                      showPassword
                        ? 'Sembunyikan kata sandi'
                        : 'Tampilkan kata sandi'
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="remember"
          render={({ field }) => (
            <Field
              orientation="horizontal"
              className="min-h-11 items-center gap-3"
            >
              <Checkbox
                id="login-remember"
                className="size-5"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                onBlur={field.onBlur}
                disabled={busy}
              />
              <FieldLabel
                htmlFor="login-remember"
                className="min-h-11 flex-1 items-center font-normal"
              >
                Ingat saya selama 30 hari
              </FieldLabel>
            </Field>
          )}
        />

        <noscript>
          <p className="text-destructive text-sm">
            Aktifkan JavaScript di peramban untuk masuk.
          </p>
        </noscript>

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full text-[15px]"
          disabled={!hydrated || busy || locked}
        >
          {busy ? <Spinner /> : null}
          {redirecting ? 'Membuka dasbor…' : 'Masuk'}
        </Button>
      </FieldGroup>
    </form>
  );
}
