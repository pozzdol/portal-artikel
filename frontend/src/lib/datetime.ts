/**
 * WIB (Asia/Jakarta) datetime helpers for the admin CMS.
 *
 * All calculations use `@date-fns/tz`'s `TZDate`, which performs date-part
 * getters/setters in the given time zone regardless of the host machine's
 * system time zone. This module must behave identically no matter what
 * `process.env.TZ` (or the browser's local zone) is set to.
 *
 * Backend contract (docs/05-api.md): timestamps are RFC3339 (`+07:00` on
 * output), dates are `YYYY-MM-DD`, both meant to be read/written as WIB.
 */

import { TZDate } from '@date-fns/tz';
import { endOfDay, format, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';

/** IANA time zone name for Western Indonesian Time. */
export const WIB = 'Asia/Jakarta';

export type DateInput = string | number | Date;

/** Parses any date-like input into a `TZDate` anchored to Asia/Jakarta. */
export function toWib(input: DateInput): TZDate {
  if (input instanceof Date) return new TZDate(input.getTime(), WIB);
  if (typeof input === 'string') return new TZDate(input, WIB);
  return new TZDate(input, WIB);
}

function toInstantMs(input: DateInput): number {
  return input instanceof Date ? input.getTime() : new Date(input).getTime();
}

export interface WibParts {
  y: number;
  /** 1-12 (human month, not JS's 0-11). */
  m: number;
  d: number;
  hh?: number;
  mm?: number;
  ss?: number;
}

/** Builds a `Date` (instant) from WIB wall-clock parts. */
export function fromWibParts({
  y,
  m,
  d,
  hh = 0,
  mm = 0,
  ss = 0,
}: WibParts): Date {
  return new TZDate(y, m - 1, d, hh, mm, ss, WIB);
}

/** Formats a date-like input using a date-fns pattern, in WIB + `id` locale. */
export function formatWib(input: DateInput, pattern: string): string {
  return format(toWib(input), pattern, { locale: id });
}

/**
 * Returns the RFC3339 instant string the backend expects, via
 * `date.toISOString()`. Given a plain `Date` this renders with a `Z` (UTC)
 * suffix; given a `TZDate` (e.g. from `toWib`/`fromWibParts`) it renders
 * with that date's own offset (`+07:00` for WIB) — both are valid RFC3339
 * and represent the same instant, and the backend accepts either.
 */
export function toRfc3339(date: Date): string {
  return date.toISOString();
}

/** `'YYYY-MM-DD'` calendar date of the input, as seen from WIB. */
export function dateOnly(input: DateInput): string {
  return format(toWib(input), 'yyyy-MM-dd');
}

/** Midnight (00:00:00.000) of the input's WIB calendar day, as an instant. */
export function startOfDayWib(input: DateInput): Date {
  return startOfDay(toWib(input));
}

/** End of day (23:59:59.999) of the input's WIB calendar day, as an instant. */
export function endOfDayWib(input: DateInput): Date {
  return endOfDay(toWib(input));
}

/**
 * Indonesian relative time, e.g. "3 menit lalu". `now` defaults to the
 * current instant; pass it explicitly in tests for determinism.
 */
export function relativeWib(
  input: DateInput,
  now: DateInput = Date.now(),
): string {
  const targetMs = toInstantMs(input);
  const nowMs = toInstantMs(now);
  const diffSec = Math.max(0, Math.round((nowMs - targetMs) / 1000));

  if (diffSec < 60) return 'baru saja';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} bulan lalu`;

  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear} tahun lalu`;
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Parses a `'HH:mm'` (24h) string; returns `null` if it isn't valid. */
export function parseTimeInput(
  value: string,
): { hh: number; mm: number } | null {
  const match = TIME_RE.exec(value.trim());
  if (!match) return null;
  return { hh: Number(match[1]), mm: Number(match[2]) };
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Combines a `'YYYY-MM-DD'` + `'HH:mm'` WIB wall-clock pair into RFC3339. */
export function combineDateTimeWib(dateStr: string, timeStr: string): string {
  const dm = DATE_ONLY_RE.exec(dateStr);
  if (!dm) throw new Error(`combineDateTimeWib: invalid date "${dateStr}"`);
  const time = parseTimeInput(timeStr);
  if (!time) throw new Error(`combineDateTimeWib: invalid time "${timeStr}"`);

  const instant = fromWibParts({
    y: Number(dm[1]),
    m: Number(dm[2]),
    d: Number(dm[3]),
    hh: time.hh,
    mm: time.mm,
  });
  return toRfc3339(instant);
}

/** Splits an RFC3339 instant into WIB `'YYYY-MM-DD'` + `'HH:mm'` parts. */
export function splitDateTimeWib(rfc3339: string): {
  date: string;
  time: string;
} {
  const d = toWib(rfc3339);
  return {
    date: format(d, 'yyyy-MM-dd'),
    time: format(d, 'HH:mm'),
  };
}
