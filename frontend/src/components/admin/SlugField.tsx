'use client';

import * as React from 'react';
import { CheckIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import { useDebounce } from '@/lib/hooks/useDebounce';

const MAX_LEN = 160;

// Mirrors backend/internal/slugutil.diacritics exactly.
const DIACRITICS: Record<string, string> = {
  à: 'a',
  á: 'a',
  â: 'a',
  ã: 'a',
  ä: 'a',
  å: 'a',
  ā: 'a',
  ă: 'a',
  ą: 'a',
  ç: 'c',
  ć: 'c',
  č: 'c',
  ď: 'd',
  đ: 'd',
  è: 'e',
  é: 'e',
  ê: 'e',
  ë: 'e',
  ē: 'e',
  ė: 'e',
  ę: 'e',
  ě: 'e',
  ğ: 'g',
  ḥ: 'h',
  ħ: 'h',
  ì: 'i',
  í: 'i',
  î: 'i',
  ï: 'i',
  ī: 'i',
  ı: 'i',
  ñ: 'n',
  ń: 'n',
  ň: 'n',
  ò: 'o',
  ó: 'o',
  ô: 'o',
  õ: 'o',
  ö: 'o',
  ø: 'o',
  ō: 'o',
  ő: 'o',
  ř: 'r',
  ś: 's',
  š: 's',
  ş: 's',
  ṣ: 's',
  ß: 'ss',
  ť: 't',
  ṭ: 't',
  ù: 'u',
  ú: 'u',
  û: 'u',
  ü: 'u',
  ū: 'u',
  ů: 'u',
  ű: 'u',
  ý: 'y',
  ÿ: 'y',
  ź: 'z',
  ż: 'z',
  ž: 'z',
  ẓ: 'z',
  æ: 'ae',
  œ: 'oe',
};

// Apostrophes join words: "Qur'an" -> "quran" (matches slugutil.Make).
const APOSTROPHES = new Set(["'", '’', 'ʼ', 'ʻ']);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Turns `input` into a URL slug matching backend/internal/slugutil.Make: lowercase
 * a-z0-9 with single dashes between runs, diacritics folded to ASCII, apostrophes
 * dropped (joining words), at most 160 chars, no leading/trailing dash.
 */
export function slugify(input: string): string {
  let out = '';
  let dash = false;
  for (const ch of input.toLowerCase()) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      out += ch;
      dash = false;
    } else if (DIACRITICS[ch]) {
      out += DIACRITICS[ch];
      dash = false;
    } else if (APOSTROPHES.has(ch)) {
      // joined, no separator
    } else if (out.length > 0 && !dash) {
      out += '-';
      dash = true;
    }
  }
  out = out.replace(/-+$/, '');
  if (out.length > MAX_LEN) {
    out = out.slice(0, MAX_LEN).replace(/-+$/, '');
  }
  return out;
}

export function isValidSlug(slug: string): boolean {
  return slug.length <= MAX_LEN && SLUG_RE.test(slug);
}

export type SlugCheckResult = { available: boolean; suggestion?: string };

export type SlugFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** The title/name field this slug is derived from while in "auto" mode. */
  sourceValue: string;
  /** Human label of the source field for helper copy, e.g. "judul" or "nama". */
  autoFrom: string;
  /** e.g. (slug) => articlesApi.slugCheck(slug, article?.id).then(r => r) */
  checkAvailability?: (slug: string) => Promise<SlugCheckResult>;
  label?: string;
  disabled?: boolean;
  error?: string;
  id?: string;
};

/** Slug input: follows `sourceValue` until manually edited, with an optional realtime
 * availability check (debounced). */
export function SlugField({
  value,
  onChange,
  sourceValue,
  autoFrom,
  checkAvailability,
  label = 'Slug',
  disabled,
  error,
  id,
}: SlugFieldProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const [auto, setAuto] = React.useState(
    () => value === '' || value === slugify(sourceValue),
  );
  // Keyed by the slug it was computed for, and only ever written from inside the async
  // check's own then()/catch() — never synchronously in the effect body — so a stale
  // result for a since-changed slug is simply ignored at render time (see `result` below).
  const [checked, setChecked] = React.useState<{
    slug: string;
    res: SlugCheckResult;
  } | null>(null);
  const debounced = useDebounce(value, 400);

  React.useEffect(() => {
    if (!auto) return;
    const next = slugify(sourceValue);
    if (next !== value) onChange(next);
    // Only re-derive when auto-following or the source text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, sourceValue]);

  // "Checkable" is derived at render time so there is nothing to reset when it turns false.
  const canCheck = !!checkAvailability && !!debounced && isValidSlug(debounced);

  React.useEffect(() => {
    if (!canCheck || !checkAvailability) return;
    let cancelled = false;
    checkAvailability(debounced)
      .then((res) => {
        if (!cancelled) setChecked({ slug: debounced, res });
      })
      .catch(() => {
        if (!cancelled) setChecked(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canCheck, debounced, checkAvailability]);

  const result = checked && checked.slug === debounced ? checked.res : null;
  const suggestion = result?.suggestion;
  const displayStatus: 'idle' | 'checking' | 'available' | 'taken' = !canCheck
    ? 'idle'
    : !result
      ? 'checking'
      : result.available
        ? 'available'
        : 'taken';

  function handleChange(raw: string) {
    setAuto(false);
    onChange(slugify(raw));
  }

  function handleResetAuto() {
    setAuto(true);
    onChange(slugify(sourceValue));
  }

  function applySuggestion() {
    if (!suggestion) return;
    setAuto(false);
    onChange(suggestion);
  }

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          aria-invalid={!!error}
          className="font-mono text-sm"
          maxLength={MAX_LEN}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        {!auto ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetAuto}
            disabled={disabled}
          >
            Otomatis
          </Button>
        ) : null}
      </div>
      <FieldDescription className="flex items-center gap-1.5">
        {auto ? (
          `Otomatis dari ${autoFrom}.`
        ) : checkAvailability ? (
          <>
            {displayStatus === 'checking' ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : null}
            {displayStatus === 'available' ? (
              <CheckIcon className="text-success size-3.5" />
            ) : null}
            {displayStatus === 'taken' ? (
              <TriangleAlertIcon className="text-destructive size-3.5" />
            ) : null}
            <span>
              {displayStatus === 'checking'
                ? 'Memeriksa ketersediaan…'
                : displayStatus === 'available'
                  ? 'Slug tersedia.'
                  : displayStatus === 'taken'
                    ? 'Slug sudah dipakai.'
                    : 'Huruf kecil, angka, dan tanda hubung.'}
            </span>
          </>
        ) : (
          `Diedit manual — tidak lagi mengikuti ${autoFrom}.`
        )}
      </FieldDescription>
      {displayStatus === 'taken' && suggestion ? (
        <button
          type="button"
          onClick={applySuggestion}
          className="text-gold-strong w-fit text-left text-sm underline underline-offset-2"
        >
          Gunakan “{suggestion}”
        </button>
      ) : null}
      <FieldError errors={[error ? { message: error } : undefined]} />
    </Field>
  );
}
