// Maps ApiClientError responses onto react-hook-form fields and toasts.
//
// Backend 422 `fields` keys come from the Go validator (json names, nested as
// "items[0].label") or from services ("config.more_link.href", "tag_ids").
// Matching per key: fieldMap override → exact path → progressively shorter
// suffixes (config.more_link.href → more_link.href → href). A key matches when
// the form has a value (≠ undefined) at that path, or when it is listed in
// `knownFields` — so give every field a defaultValue (null, not undefined).

import { toast } from 'sonner';
import type {
  FieldPath,
  FieldValues,
  UseFormGetValues,
  UseFormSetError,
} from 'react-hook-form';

import { isApiClientError, type ApiClientError } from '@/lib/api/client';

export type FormLike<T extends FieldValues> = {
  setError: UseFormSetError<T>;
  getValues: UseFormGetValues<T>;
};

export type Notify = (message: string, opts?: { description?: string }) => void;

export type ApplyServerErrorsOptions<T extends FieldValues> = {
  /** Server key → form path overrides, e.g. { seo_title: 'seo.title' }. */
  fieldMap?: Record<string, FieldPath<T>>;
  /** Paths that exist even when their current value is undefined. */
  knownFields?: readonly string[];
  /** Toast sink (defaults to sonner's toast.error). */
  notify?: Notify;
  /** Focus the first matched field (default true). */
  shouldFocus?: boolean;
};

export type ApplyServerErrorsResult = {
  /** True if the error was an ApiClientError (and was reported somehow). */
  handled: boolean;
  /** Server keys mapped to form paths. */
  matched: Record<string, string>;
  /** Server field errors that matched no form field (were toasted). */
  unmatched: Record<string, string>;
};

const defaultNotify: Notify = (message, opts) => {
  toast.error(message, opts);
};

/** "items[0].label" → "items.0.label" */
export function normalizeFieldKey(key: string): string {
  return key.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
}

/** Candidate form paths for a server key, most specific first. */
export function candidatePaths(key: string): string[] {
  const norm = normalizeFieldKey(key);
  const parts = norm.split('.');
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts.slice(i).join('.');
    // A bare array index is never a useful target.
    if (p && !/^\d+$/.test(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

export function rateLimitMessage(err: ApiClientError): string {
  const secs = err.retryAfter;
  return secs && secs > 0
    ? `Terlalu banyak percobaan. Coba lagi dalam ${secs} detik.`
    : 'Terlalu banyak percobaan. Coba lagi nanti.';
}

/** Human (Indonesian) message for any thrown value. */
export function apiErrorMessage(err: unknown): string {
  if (isApiClientError(err)) {
    if (err.status === 429) return rateLimitMessage(err);
    return err.message;
  }
  if (err instanceof Error && err.name === 'AbortError')
    return 'Permintaan dibatalkan.';
  return 'Terjadi kesalahan yang tidak terduga.';
}

/**
 * Toast an error that is not tied to a form (409 conflict, 403, 429, 5xx…).
 * 401 is silent: the admin gate handles `admin:unauthenticated`.
 */
export function toastApiError(
  err: unknown,
  notify: Notify = defaultNotify,
): void {
  if (isApiClientError(err) && err.status === 401) return;
  if (err instanceof Error && err.name === 'AbortError') return;
  if (isApiClientError(err) && err.fields) {
    notify(err.message, { description: formatFields(err.fields) });
    return;
  }
  notify(apiErrorMessage(err));
}

function formatFields(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function hasPath(values: unknown, path: string): boolean {
  let cur: unknown = values;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return false;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur !== undefined;
}

/**
 * Apply a thrown error to `form`. 422 fields → setError (type "server");
 * leftovers and every other error kind → toast. Returns what was matched.
 */
export function applyServerErrors<T extends FieldValues>(
  form: FormLike<T>,
  err: unknown,
  opts: ApplyServerErrorsOptions<T> = {},
): ApplyServerErrorsResult {
  const notify = opts.notify ?? defaultNotify;
  const result: ApplyServerErrorsResult = {
    handled: false,
    matched: {},
    unmatched: {},
  };
  if (!isApiClientError(err)) {
    if (!(err instanceof Error && err.name === 'AbortError'))
      notify(apiErrorMessage(err));
    return result;
  }
  result.handled = true;

  if (err.status !== 422 || !err.fields) {
    toastApiError(err, notify);
    return result;
  }

  const values = form.getValues();
  const known = new Set(opts.knownFields ?? []);
  let focus = opts.shouldFocus ?? true;

  for (const [key, message] of Object.entries(err.fields)) {
    const override = opts.fieldMap?.[key];
    const candidates = override ? [override as string] : candidatePaths(key);
    const target =
      override ?? candidates.find((p) => known.has(p) || hasPath(values, p));
    if (target) {
      form.setError(
        target as FieldPath<T>,
        { type: 'server', message },
        { shouldFocus: focus },
      );
      focus = false;
      result.matched[key] = target;
    } else {
      result.unmatched[key] = message;
    }
  }

  const leftovers = Object.keys(result.unmatched).length;
  if (leftovers > 0) {
    notify(err.message, { description: formatFields(result.unmatched) });
  } else if (Object.keys(result.matched).length === 0) {
    notify(err.message);
  }
  return result;
}
