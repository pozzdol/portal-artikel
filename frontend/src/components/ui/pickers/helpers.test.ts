import { describe, expect, test } from 'bun:test';

import {
  addDaysYmd,
  buildTimeOptions,
  dateToYmd,
  formatDateText,
  formatRangeLabel,
  isYmd,
  isYmdWithin,
  matchPreset,
  normalizeRange,
  normalizeTimeText,
  parseDateText,
  rangePresets,
  ymdToDate,
} from './helpers';

describe('date text', () => {
  test('parses dd/MM/yyyy variants and ISO', () => {
    expect(parseDateText('27/09/2026')).toBe('2026-09-27');
    expect(parseDateText('7/9/2026')).toBe('2026-09-07');
    expect(parseDateText(' 07-09-2026 ')).toBe('2026-09-07');
    expect(parseDateText('07.09.2026')).toBe('2026-09-07');
    expect(parseDateText('2026-09-07')).toBe('2026-09-07');
  });
  test('rejects impossible or malformed dates', () => {
    expect(parseDateText('31/02/2026')).toBeNull();
    expect(parseDateText('29/02/2025')).toBeNull();
    expect(parseDateText('29/02/2024')).toBe('2024-02-29');
    expect(parseDateText('13/13/2026')).toBeNull();
    expect(parseDateText('27/09/26')).toBeNull();
    expect(parseDateText('besok')).toBeNull();
    expect(parseDateText('')).toBeNull();
  });
  test('formats and validates ymd', () => {
    expect(formatDateText('2026-09-07')).toBe('07/09/2026');
    expect(formatDateText(null)).toBe('');
    expect(formatDateText('2026-9-7')).toBe('');
    expect(isYmd('2026-02-30')).toBe(false);
    expect(isYmd('2026-02-28')).toBe(true);
  });
});

describe('WIB date conversion', () => {
  test('ymdToDate is WIB midnight regardless of host TZ', () => {
    const d = ymdToDate('2026-09-27')!;
    expect(d.toISOString()).toBe('2026-09-27T00:00:00.000+07:00');
    expect(new Date(d.getTime()).toISOString()).toBe(
      '2026-09-26T17:00:00.000Z',
    );
    expect(dateToYmd(d)).toBe('2026-09-27');
  });
  test('dateToYmd uses the WIB calendar day', () => {
    // 18:30Z = 01:30 WIB next day
    expect(dateToYmd(new Date('2026-09-26T18:30:00Z'))).toBe('2026-09-27');
  });
  test('addDaysYmd crosses months and years', () => {
    expect(addDaysYmd('2026-09-27', -29)).toBe('2026-08-29');
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysYmd('2024-03-01', -1)).toBe('2024-02-29');
  });
  test('isYmdWithin is inclusive and ignores invalid bounds', () => {
    expect(isYmdWithin('2026-09-27', '2026-09-27', '2026-09-27')).toBe(true);
    expect(isYmdWithin('2026-09-26', '2026-09-27')).toBe(false);
    expect(isYmdWithin('2026-09-28', undefined, '2026-09-27')).toBe(false);
    expect(isYmdWithin('2026-09-28', 'x', null)).toBe(true);
  });
});

describe('time', () => {
  test('normalizes typed times', () => {
    expect(normalizeTimeText('7:30')).toBe('07:30');
    expect(normalizeTimeText('07.30')).toBe('07:30');
    expect(normalizeTimeText('0730')).toBe('07:30');
    expect(normalizeTimeText('730')).toBe('07:30');
    expect(normalizeTimeText('7')).toBe('07:00');
    expect(normalizeTimeText('23:59')).toBe('23:59');
    expect(normalizeTimeText('24:00')).toBeNull();
    expect(normalizeTimeText('12:60')).toBeNull();
    expect(normalizeTimeText('abc')).toBeNull();
  });
  test('builds slot lists', () => {
    const q = buildTimeOptions(15);
    expect(q.length).toBe(96);
    expect(q[0]).toBe('00:00');
    expect(q[1]).toBe('00:15');
    expect(q.at(-1)).toBe('23:45');
    expect(buildTimeOptions(30).length).toBe(48);
    expect(buildTimeOptions(0).length).toBe(96);
  });
});

describe('ranges', () => {
  // 2026-09-30T20:00Z is 1 Oct 03:00 WIB: presets must follow the WIB day.
  const now = new Date('2026-09-30T20:00:00Z');
  test('presets are computed on the WIB calendar', () => {
    const p = Object.fromEntries(
      rangePresets(now).map((x) => [x.key, [x.from, x.to]]),
    );
    expect(p.today).toEqual(['2026-10-01', '2026-10-01']);
    expect(p.last7).toEqual(['2026-09-25', '2026-10-01']);
    expect(p.last30).toEqual(['2026-09-02', '2026-10-01']);
    expect(p.thisMonth).toEqual(['2026-10-01', '2026-10-31']);
    expect(rangePresets(now).map((x) => x.label)).toEqual([
      'Hari ini',
      '7 hari terakhir',
      '30 hari terakhir',
      'Bulan ini',
    ]);
  });
  test('matchPreset and normalizeRange', () => {
    const presets = rangePresets(now);
    expect(matchPreset({ from: '2026-09-25', to: '2026-10-01' }, presets)).toBe(
      'last7',
    );
    expect(matchPreset({ from: '2026-09-25' }, presets)).toBe('');
    expect(normalizeRange({ from: '2026-10-05', to: '2026-10-01' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-05',
    });
  });
  test('labels', () => {
    expect(formatRangeLabel({ from: '2026-09-01', to: '2026-09-27' })).toBe(
      '1 Sep – 27 Sep 2026',
    );
    expect(formatRangeLabel({ from: '2025-12-30', to: '2026-01-02' })).toBe(
      '30 Des 2025 – 2 Jan 2026',
    );
    expect(formatRangeLabel({ from: '2026-09-27', to: '2026-09-27' })).toBe(
      '27 Sep 2026',
    );
    expect(formatRangeLabel({ from: '2026-09-27' })).toBe('Sejak 27 Sep 2026');
    expect(formatRangeLabel({ to: '2026-09-27' })).toBe('Hingga 27 Sep 2026');
    expect(formatRangeLabel({})).toBe('');
  });
});
