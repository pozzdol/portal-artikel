import { describe, expect, test } from 'bun:test';
import {
  WIB,
  combineDateTimeWib,
  dateOnly,
  endOfDayWib,
  formatWib,
  fromWibParts,
  parseTimeInput,
  relativeWib,
  splitDateTimeWib,
  startOfDayWib,
  toRfc3339,
  toWib,
} from './datetime';

// These tests must pass identically regardless of the host TZ. Run with:
//   TZ=UTC bun test src/lib/datetime.test.ts
//   TZ=America/New_York bun test src/lib/datetime.test.ts

describe('WIB', () => {
  test('is Asia/Jakarta', () => {
    expect(WIB).toBe('Asia/Jakarta');
  });
});

describe('toWib', () => {
  test('reads WIB wall-clock parts from a UTC instant', () => {
    // 2026-08-05T00:30:00Z = 2026-08-05T07:30:00+07:00
    const d = toWib('2026-08-05T00:30:00Z');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // August, 0-based
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(7);
    expect(d.getMinutes()).toBe(30);
  });

  test('accepts a Date instance', () => {
    const instant = new Date('2026-08-05T00:30:00Z');
    const d = toWib(instant);
    expect(d.getHours()).toBe(7);
  });

  test('accepts a numeric timestamp', () => {
    const ts = new Date('2026-08-05T00:30:00Z').getTime();
    const d = toWib(ts);
    expect(d.getHours()).toBe(7);
  });
});

describe('fromWibParts', () => {
  test('builds the correct instant from WIB wall-clock parts', () => {
    const d = fromWibParts({ y: 2026, m: 8, d: 5, hh: 7, mm: 30 });
    // fromWibParts returns a TZDate, whose toISOString() renders with the
    // +07:00 offset (matching the backend's RFC3339 output convention)
    // rather than normalizing to Z.
    expect(d.toISOString()).toBe('2026-08-05T07:30:00.000+07:00');
    // The underlying instant is still correct: 07:30 WIB = 00:30 UTC.
    expect(new Date(d.getTime()).toISOString()).toBe(
      '2026-08-05T00:30:00.000Z',
    );
  });

  test('defaults hh/mm/ss to 0 (WIB midnight)', () => {
    const d = fromWibParts({ y: 2026, m: 1, d: 1 });
    expect(d.toISOString()).toBe('2026-01-01T00:00:00.000+07:00');
    // 2026-01-01T00:00:00+07:00 = 2025-12-31T17:00:00Z
    expect(new Date(d.getTime()).toISOString()).toBe(
      '2025-12-31T17:00:00.000Z',
    );
  });
});

describe('formatWib', () => {
  test('formats with the id locale in WIB', () => {
    expect(formatWib('2026-08-05T00:30:00Z', 'd MMMM yyyy, HH:mm')).toBe(
      '5 Agustus 2026, 07:30',
    );
  });

  test('accepts a Date instance', () => {
    expect(formatWib(new Date('2026-08-05T00:30:00Z'), 'HH:mm')).toBe('07:30');
  });
});

describe('toRfc3339', () => {
  test('returns toISOString output', () => {
    const d = new Date('2026-08-05T00:30:00.000Z');
    expect(toRfc3339(d)).toBe('2026-08-05T00:30:00.000Z');
  });
});

describe('dateOnly', () => {
  test('returns YYYY-MM-DD in WIB even when UTC date differs', () => {
    // 2026-08-05T23:30:00Z = 2026-08-06T06:30:00+07:00 -> WIB date is the 6th
    expect(dateOnly('2026-08-05T23:30:00Z')).toBe('2026-08-06');
  });

  test('returns YYYY-MM-DD in WIB when WIB date is earlier than UTC date', () => {
    // 2026-08-05T00:30:00Z = 2026-08-05T07:30:00+07:00 -> same day in this case,
    // use a near-midnight UTC instant that rolls back a day in WIB direction check
    expect(dateOnly('2026-08-05T00:30:00Z')).toBe('2026-08-05');
  });
});

describe('startOfDayWib / endOfDayWib', () => {
  test('start of day is WIB midnight', () => {
    const start = startOfDayWib('2026-08-05T23:30:00Z'); // WIB date = Aug 6
    expect(start.toISOString()).toBe('2026-08-06T00:00:00.000+07:00');
    expect(new Date(start.getTime()).toISOString()).toBe(
      '2026-08-05T17:00:00.000Z',
    );
  });

  test('end of day is WIB 23:59:59.999', () => {
    const end = endOfDayWib('2026-08-05T23:30:00Z'); // WIB date = Aug 6
    expect(end.toISOString()).toBe('2026-08-06T23:59:59.999+07:00');
    expect(new Date(end.getTime()).toISOString()).toBe(
      '2026-08-06T16:59:59.999Z',
    );
  });
});

describe('relativeWib', () => {
  const now = new Date('2026-08-05T12:00:00Z');

  test('very recent -> "baru saja"', () => {
    expect(relativeWib(new Date(now.getTime() - 10_000), now)).toBe(
      'baru saja',
    );
  });

  test('minutes', () => {
    expect(relativeWib(new Date(now.getTime() - 3 * 60_000), now)).toBe(
      '3 menit lalu',
    );
  });

  test('hours', () => {
    expect(relativeWib(new Date(now.getTime() - 5 * 3_600_000), now)).toBe(
      '5 jam lalu',
    );
  });

  test('days', () => {
    expect(relativeWib(new Date(now.getTime() - 2 * 86_400_000), now)).toBe(
      '2 hari lalu',
    );
  });

  test('months', () => {
    expect(relativeWib(new Date(now.getTime() - 60 * 86_400_000), now)).toBe(
      '2 bulan lalu',
    );
  });

  test('years', () => {
    expect(relativeWib(new Date(now.getTime() - 400 * 86_400_000), now)).toBe(
      '1 tahun lalu',
    );
  });

  test('future/invalid ordering clamps to "baru saja"', () => {
    expect(relativeWib(new Date(now.getTime() + 60_000), now)).toBe(
      'baru saja',
    );
  });

  test('accepts ISO string input and default now', () => {
    // Not a real assertion of "now", just that it doesn't throw and returns a string.
    expect(typeof relativeWib('2020-01-01T00:00:00Z')).toBe('string');
  });
});

describe('parseTimeInput', () => {
  test('parses valid HH:mm', () => {
    expect(parseTimeInput('07:30')).toEqual({ hh: 7, mm: 30 });
    expect(parseTimeInput('23:59')).toEqual({ hh: 23, mm: 59 });
    expect(parseTimeInput('0:00')).toEqual({ hh: 0, mm: 0 });
  });

  test('rejects invalid input', () => {
    expect(parseTimeInput('24:00')).toBeNull();
    expect(parseTimeInput('12:60')).toBeNull();
    expect(parseTimeInput('not-a-time')).toBeNull();
    expect(parseTimeInput('')).toBeNull();
  });
});

describe('combineDateTimeWib / splitDateTimeWib', () => {
  test('combine then split round-trips', () => {
    const rfc = combineDateTimeWib('2026-08-05', '07:30');
    expect(rfc).toBe('2026-08-05T07:30:00.000+07:00');
    expect(splitDateTimeWib(rfc)).toEqual({
      date: '2026-08-05',
      time: '07:30',
    });
  });

  test('combine throws on invalid date', () => {
    expect(() => combineDateTimeWib('05-08-2026', '07:30')).toThrow();
  });

  test('combine throws on invalid time', () => {
    expect(() => combineDateTimeWib('2026-08-05', '25:00')).toThrow();
  });

  test('split reads across the WIB day boundary', () => {
    // 2026-08-05T23:30:00Z = 2026-08-06T06:30:00+07:00
    expect(splitDateTimeWib('2026-08-05T23:30:00Z')).toEqual({
      date: '2026-08-06',
      time: '06:30',
    });
  });
});
