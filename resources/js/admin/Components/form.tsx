import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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

/* Select memakai shadcn (Radix) supaya panel dropdown-nya ikut token desain.
   Radix menolak value kosong, jadi "tidak dipilih" diwakili sentinel. */
export const SELECT_EMPTY = '__kosong';

export interface SelectOption {
    value: string;
    label: string;
}

interface SelectControlProps {
    value: string;
    onValueChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    /** Opsi kosong di puncak daftar, mis. "Semua peran". */
    emptyLabel?: string;
    disabled?: boolean;
    invalid?: boolean;
    className?: string;
    'aria-label'?: string;
    id?: string;
}

export function SelectControl({
    value,
    onValueChange,
    options,
    placeholder = 'Pilih',
    emptyLabel,
    disabled,
    invalid,
    className,
    id,
    ...rest
}: SelectControlProps) {
    return (
        <Select
            // Sentinel hanya dipakai kalau memang ada itemnya. Kalau tidak,
            // nilai dikirim undefined supaya Radix menampilkan placeholder —
            // bukan kotak kosong tanpa keterangan.
            value={value === '' ? (emptyLabel ? SELECT_EMPTY : undefined) : value}
            onValueChange={(next) => onValueChange(next === SELECT_EMPTY ? '' : next)}
            disabled={disabled}
        >
            <SelectTrigger
                id={id}
                aria-label={rest['aria-label']}
                aria-invalid={invalid || undefined}
                className={cn(
                    'ui-field ui-focus h-11 w-full border-0 px-3.5 text-[0.925rem] shadow-none',
                    'data-placeholder:text-[var(--ui-ink-2)]',
                    'focus-visible:ring-0 focus-visible:border-0',
                    invalid && 'ui-field-invalid',
                    className,
                )}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>

            <SelectContent
                position="popper"
                align="start"
                className={cn(
                    'ui-tile border-0 p-1 ring-0',
                    'min-w-[var(--radix-select-trigger-width)]',
                )}
            >
                {emptyLabel ? (
                    <SelectItem value={SELECT_EMPTY} className="ui-focus rounded-[var(--ui-r-control)] py-2 pl-2.5">
                        {emptyLabel}
                    </SelectItem>
                ) : null}

                {options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                        className="ui-focus rounded-[var(--ui-r-control)] py-2 pl-2.5"
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

interface SelectFieldProps extends SelectControlProps {
    label: string;
    hint?: string;
    error?: string;
}

export function SelectField({ label, hint, error, id, ...props }: SelectFieldProps) {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    const messageId = `${fieldId}-message`;
    const message = error ?? hint;

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId} className="text-[0.8rem] font-medium text-[var(--ui-ink)]">
                {label}
            </Label>

            <SelectControl id={fieldId} invalid={Boolean(error)} {...props} />

            {message ? (
                <p
                    id={messageId}
                    role={error ? 'alert' : undefined}
                    className={cn(
                        'text-[0.78rem] leading-snug',
                        error ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-ink-2)]',
                    )}
                >
                    {message}
                </p>
            ) : null}
        </div>
    );
}

interface CheckRowProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    title: string;
    description?: string | null;
    disabled?: boolean;
}

export function CheckRow({ checked, onChange, title, description, disabled }: CheckRowProps) {
    return (
        <label
            className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[var(--ui-r-control)] px-3 py-2.5 transition-colors',
                checked ? 'bg-[var(--ui-surface-2)]' : 'hover:bg-[var(--ui-surface-2)]',
                disabled && 'cursor-not-allowed opacity-60',
            )}
        >
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
                className="ui-focus mt-0.5 size-4 shrink-0 accent-[var(--ui-accent-ink)]"
            />
            <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                {description ? (
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ui-ink-2)]">
                        {description}
                    </span>
                ) : null}
            </span>
        </label>
    );
}

/* Avatar inisial — berlaku sampai unggah foto dibangun. Warnanya diturunkan
   dari id supaya stabil per orang, bukan acak tiap render. */
export function Avatar({ initials, id, size = 'md' }: { initials: string; id: string; size?: 'sm' | 'md' }) {
    const hue = Array.from(id).reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 360, 0);

    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full font-medium',
                size === 'sm' ? 'size-7 text-[0.7rem]' : 'size-9 text-xs',
            )}
            style={{
                backgroundColor: `oklch(0.90 0.045 ${hue})`,
                color: `oklch(0.36 0.08 ${hue})`,
            }}
        >
            {initials}
        </span>
    );
}

export function Badge({ tone = 'quiet', children }: { tone?: 'quiet' | 'ok' | 'warn' | 'danger'; children: React.ReactNode }) {
    return (
        <span
            className={cn(
                'ui-chip shrink-0 px-2 py-0.5 text-[0.68rem] font-medium whitespace-nowrap',
                tone === 'ok' && 'text-[var(--ui-ok)]',
                tone === 'warn' && 'text-[var(--ui-accent-ink)]',
                tone === 'danger' && 'text-[var(--ui-danger)]',
                tone === 'quiet' && 'text-[var(--ui-ink-2)]',
            )}
        >
            {children}
        </span>
    );
}
