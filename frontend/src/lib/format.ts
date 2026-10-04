/**
 * Locale/timezone formatting helpers for the public frontend.
 * All dates are displayed in Asia/Jakarta (WIB) using the id-ID locale, regardless
 * of the server/browser timezone. Pure functions only — no framework imports.
 */

const LOCALE = 'id-ID';
const TZ = 'Asia/Jakarta';

/** "5 Agustus 2026" */
export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** "Sabtu, 15 Agustus 2026" */
export function formatDateWeekday(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** "25 Jul" */
export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** "05.00 WIB" */
export function formatTimeWIB(iso: string): string {
  const time = new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  }).format(new Date(iso));
  return `${time} WIB`;
}

/** month: "YYYY-MM" -> "Agustus 2026" */
export function formatMonthYear(month: string): string {
  const [year, monthNum] = parseMonth(month);
  return new Intl.DateTimeFormat(LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNum - 1, 1)));
}

/** { day: '15', month: 'Agu' } */
export function dayMonthParts(iso: string): { day: string; month: string } {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    timeZone: TZ,
  }).format(date);
  const month = new Intl.DateTimeFormat(LOCALE, {
    month: 'short',
    timeZone: TZ,
  }).format(date);
  return { day, month };
}

/** 890 -> "890"; 1100 -> "1.1rb"; 3200 -> "3.2rb"; 1200000 -> "1.2jt" */
export function formatCompactNumber(n: number): string {
  const raw = new Intl.NumberFormat(LOCALE, {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(n);
  return raw.replace(/\s/g, '').replace(',', '.');
}

/** seconds -> "05:47" | "18:24" | "1:02:05" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

/** "6 menit baca" */
export function readingLabel(minutes: number): string {
  return `${minutes} menit baca`;
}

/** "6 menit" */
export function readingShort(minutes: number): string {
  return `${minutes} menit`;
}

/** "YYYY-MM-DD" (Jakarta calendar date) for use in <time datetime="..."> */
export function dateTimeAttr(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** Replace the literal "{year}" placeholder with the current Jakarta year. */
export function replaceYear(template: string): string {
  const year = new Intl.DateTimeFormat(LOCALE, {
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date());
  return template.replace(/\{year\}/g, year);
}

/** Client-only: "Minggu, 27 September 2026" for the header date label. */
export function todayJakartaLabel(): string {
  return formatDateWeekday(new Date().toISOString());
}

export type CalendarGrid = { weeks: (number | null)[][] };

/** month: "YYYY-MM" -> a 7-wide grid of day numbers, weeks starting Sunday. */
export function calendarGrid(month: string): CalendarGrid {
  const [year, monthNum] = parseMonth(month);
  const firstWeekday = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return { weeks };
}

/** month: "YYYY-MM" shifted by `delta` months -> "YYYY-MM" */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNum] = parseMonth(month);
  const shifted = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function parseMonth(month: string): [number, number] {
  const [yearStr, monthStr] = month.split('-');
  return [Number(yearStr), Number(monthStr)];
}
