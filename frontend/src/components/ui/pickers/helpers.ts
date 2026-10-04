/**
 * Pure helpers shared by the WIB date/time pickers. Everything here is
 * time-zone safe: calendar dates are `'YYYY-MM-DD'` strings interpreted in
 * Asia/Jakarta, never in the host's local zone.
 */

import { TZDate } from '@date-fns/tz';
import { addDays, endOfMonth, startOfMonth } from 'date-fns';

import {
  WIB,
  dateOnly,
  formatWib,
  toWib,
  type DateInput,
} from '@/lib/datetime';

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** `true` when the string is a real `'YYYY-MM-DD'` calendar date. */
export function isYmd(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = YMD_RE.exec(value);
  return !!m && isRealDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/**
 * Parses what a user typed into a date field. Accepts `dd/MM/yyyy` (also with
 * `-` or `.` separators and single-digit day/month) and ISO `yyyy-MM-dd`.
 * Returns `'YYYY-MM-DD'` or `null` when it is not a real date.
 */
export function parseDateText(text: string): string | null {
  const t = text.trim();
  let y: number, m: number, d: number;
  const dmy = DMY_RE.exec(t);
  const iso = dmy ? null : ISO_RE.exec(t);
  if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
  } else if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    return null;
  }
  if (!isRealDate(y, m, d)) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** `'YYYY-MM-DD'` → `'dd/MM/yyyy'` (the typed-input format). */
export function formatDateText(ymd: string | null | undefined): string {
  if (!isYmd(ymd)) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/** `'YYYY-MM-DD'` → WIB-midnight `TZDate` for react-day-picker, or `undefined`. */
export function ymdToDate(ymd: string | null | undefined): TZDate | undefined {
  if (!isYmd(ymd)) return undefined;
  const [y, m, d] = ymd.split('-').map(Number);
  return new TZDate(y, m - 1, d, WIB);
}

/** Calendar day (WIB) of any date-like value as `'YYYY-MM-DD'`. */
export function dateToYmd(date: DateInput): string {
  return dateOnly(date);
}

/** Adds (or subtracts) whole days to a `'YYYY-MM-DD'` string. */
export function addDaysYmd(ymd: string, days: number): string {
  const base = ymdToDate(ymd);
  if (!base) throw new Error(`addDaysYmd: invalid date "${ymd}"`);
  return dateToYmd(addDays(base, days));
}

/** `true` if `ymd` falls inside the optional inclusive `[min, max]` bounds. */
export function isYmdWithin(
  ymd: string,
  min?: string | null,
  max?: string | null,
): boolean {
  if (isYmd(min) && ymd < min) return false;
  if (isYmd(max) && ymd > max) return false;
  return true;
}

/** Human label for a date, e.g. `'27 Sep 2026'` (Indonesian, WIB). */
export function formatDateLabel(
  ymd: string | null | undefined,
  pattern = 'd MMM yyyy',
): string {
  const d = ymdToDate(ymd);
  return d ? formatWib(d, pattern) : '';
}

/**
 * Normalises a typed time. Accepts `H:mm`, `HH:mm`, `HH.mm`, `HHmm`, `Hmm`
 * and a bare hour (`7` → `07:00`). Returns `'HH:mm'` (24h) or `null`.
 */
export function normalizeTimeText(text: string): string | null {
  const t = text.trim();
  let hh: number, mm: number;
  let m = /^(\d{1,2})[:.](\d{2})$/.exec(t);
  if (m) {
    hh = Number(m[1]);
    mm = Number(m[2]);
  } else if ((m = /^(\d{1,2})$/.exec(t))) {
    hh = Number(m[1]);
    mm = 0;
  } else if ((m = /^(\d{1,2})(\d{2})$/.exec(t))) {
    hh = Number(m[1]);
    mm = Number(m[2]);
  } else {
    return null;
  }
  if (hh > 23 || mm > 59) return null;
  return `${pad2(hh)}:${pad2(mm)}`;
}

/** All `'HH:mm'` slots of a day for the given minute step (clamped to 1–720). */
export function buildTimeOptions(step = 15): string[] {
  const s = Math.min(720, Math.max(1, Math.floor(step) || 15));
  const out: string[] = [];
  for (let t = 0; t < 24 * 60; t += s)
    out.push(`${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`);
  return out;
}

export type DateRangeValue = { from?: string; to?: string };

export type RangePresetKey = 'today' | 'last7' | 'last30' | 'thisMonth';

export interface RangePreset {
  key: RangePresetKey;
  label: string;
  from: string;
  to: string;
}

/** Quick ranges relative to `now`, all computed on the WIB calendar. */
export function rangePresets(now: DateInput = Date.now()): RangePreset[] {
  const wibNow = toWib(now);
  const today = dateToYmd(wibNow);
  return [
    { key: 'today', label: 'Hari ini', from: today, to: today },
    {
      key: 'last7',
      label: '7 hari terakhir',
      from: addDaysYmd(today, -6),
      to: today,
    },
    {
      key: 'last30',
      label: '30 hari terakhir',
      from: addDaysYmd(today, -29),
      to: today,
    },
    {
      key: 'thisMonth',
      label: 'Bulan ini',
      from: dateToYmd(startOfMonth(wibNow)),
      to: dateToYmd(endOfMonth(wibNow)),
    },
  ];
}

/** Which preset (if any) exactly matches the range. */
export function matchPreset(
  value: DateRangeValue,
  presets: RangePreset[],
): RangePresetKey | '' {
  return (
    presets.find((p) => p.from === value.from && p.to === value.to)?.key ?? ''
  );
}

/** Orders a range so `from <= to`. */
export function normalizeRange(value: DateRangeValue): DateRangeValue {
  const { from, to } = value;
  if (from && to && from > to) return { from: to, to: from };
  return value;
}

/** Trigger label for a range, e.g. `'1 Sep 2026 – 27 Sep 2026'`. */
export function formatRangeLabel(value: DateRangeValue): string {
  const { from, to } = value;
  if (from && to) {
    if (from === to) return formatDateLabel(from);
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    return `${formatDateLabel(from, sameYear ? 'd MMM' : 'd MMM yyyy')} – ${formatDateLabel(to)}`;
  }
  if (from) return `Sejak ${formatDateLabel(from)}`;
  if (to) return `Hingga ${formatDateLabel(to)}`;
  return '';
}
