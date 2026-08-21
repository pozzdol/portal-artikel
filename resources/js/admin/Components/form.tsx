import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/* Skin soft-minimalist di atas primitif shadcn. Perilaku, a11y, dan varian
   tetap milik shadcn; hanya permukaannya yang diganti. */

interface FieldProps extends React.ComponentProps<'input'> {
    label: string;
    hint?: string;
    error?: string;
    success?: string;
}

export function Field({ label, hint, error, success, className, id, ...props }: FieldProps) {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    const messageId = `${fieldId}-message`;
    const message = error ?? success ?? hint;

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId} className="text-[0.8rem] font-medium text-[var(--ui-ink)]">
                {label}
            </Label>

            <Input
                id={fieldId}
                aria-invalid={error ? true : undefined}
                aria-describedby={message ? messageId : undefined}
                className={cn(
                    'ui-field ui-focus h-11 border-0 px-3.5 text-[0.925rem] md:text-[0.925rem]',
                    'placeholder:text-[var(--ui-ink-2)]',
                    'focus-visible:ring-0 focus-visible:border-0',
                    error && 'ui-field-invalid',
                    className,
                )}
                {...props}
            />

            {message ? (
                <p
                    id={messageId}
                    role={error ? 'alert' : undefined}
                    className={cn(
                        'text-[0.78rem] leading-snug',
                        error && 'text-[var(--ui-danger)]',
                        success && 'text-[var(--ui-ok)]',
                        !error && !success && 'text-[var(--ui-ink-2)]',
                    )}
                >
                    {message}
                </p>
            ) : null}
        </div>
    );
}

interface SubmitButtonProps extends React.ComponentProps<typeof Button> {
    loading?: boolean;
    loadingLabel?: string;
    tone?: 'solid' | 'quiet';
}

export function SubmitButton({
    loading = false,
    loadingLabel = 'Memproses',
    tone = 'solid',
    disabled,
    className,
    children,
    ...props
}: SubmitButtonProps) {
    return (
        <Button
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(
                tone === 'solid' ? 'ui-btn' : 'ui-btn-quiet',
                'ui-focus h-11 w-full border-0 text-[0.925rem] font-medium',
                'focus-visible:ring-0 focus-visible:border-0',
                'active:not-aria-[haspopup]:translate-y-px',
                className,
            )}
            {...props}
        >
            {loading ? (
                <>
                    <span
                        aria-hidden="true"
                        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60"
                    />
                    {loadingLabel}
                </>
            ) : (
                children
            )}
        </Button>
    );
}

export function TextLink({ className, ...props }: React.ComponentProps<'a'>) {
    return (
        <a
            className={cn(
                'ui-focus rounded-sm font-medium text-[var(--ui-accent-ink)] underline-offset-4 hover:underline',
                className,
            )}
            {...props}
        />
    );
}
