import { describe, expect, test } from 'bun:test';
import {
  calendarGrid,
  dateTimeAttr,
  dayMonthParts,
  formatCompactNumber,
  formatDateLong,
  formatDateShort,
  formatDateWeekday,
  formatDuration,
  formatMonthYear,
  formatTimeWIB,
  readingLabel,
  readingShort,
  replaceYear,
  shiftMonth,
} from './format';

describe('formatDateLong', () => {
  test('formats a long Indonesian date in WIB', () => {
    expect(formatDateLong('2026-08-05T07:00:00+07:00')).toBe('5 Agustus 2026');
  });
});

describe('formatDateWeekday', () => {
  test('formats weekday + long date', () => {
    expect(formatDateWeekday('2026-08-15T05:00:00+07:00')).toBe(
      'Sabtu, 15 Agustus 2026',
    );
  });
});

describe('formatDateShort', () => {
  test('formats a short day + month', () => {
    expect(formatDateShort('2026-07-25T00:00:00+07:00')).toBe('25 Jul');
  });
});

describe('formatTimeWIB', () => {
  test('formats a time with the WIB suffix', () => {
    expect(formatTimeWIB('2026-08-15T05:00:00+07:00')).toBe('05.00 WIB');
  });
});

describe('formatMonthYear', () => {
  test('formats "YYYY-MM" as a long month + year', () => {
    expect(formatMonthYear('2026-08')).toBe('Agustus 2026');
  });
});

describe('dayMonthParts', () => {
  test('splits an ISO date into day + short month', () => {
    expect(dayMonthParts('2026-08-15T05:00:00+07:00')).toEqual({
      day: '15',
      month: 'Agu',
    });
  });
});

describe('formatCompactNumber', () => {
  test('leaves small numbers untouched', () => {
    expect(formatCompactNumber(890)).toBe('890');
  });

  test('compacts thousands with a period decimal and "rb" suffix', () => {
    expect(formatCompactNumber(1100)).toBe('1.1rb');
    expect(formatCompactNumber(3200)).toBe('3.2rb');
  });

  test('compacts millions with "jt" suffix', () => {
    expect(formatCompactNumber(1200000)).toBe('1.2jt');
  });
});

describe('formatDuration', () => {
  test('formats sub-hour durations as mm:ss', () => {
    expect(formatDuration(347)).toBe('05:47');
    expect(formatDuration(1104)).toBe('18:24');
  });

  test('formats hour-plus durations as h:mm:ss', () => {
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});

describe('readingLabel / readingShort', () => {
  test('produces Indonesian reading-time labels', () => {
    expect(readingLabel(6)).toBe('6 menit baca');
    expect(readingShort(6)).toBe('6 menit');
  });
});

describe('dateTimeAttr', () => {
  test('formats an ISO instant as a Jakarta calendar date', () => {
    expect(dateTimeAttr('2026-08-15T05:00:00+07:00')).toBe('2026-08-15');
  });

  test('converts a UTC instant into its Jakarta calendar date', () => {
    // 2026-01-01T23:00:00Z is already 2026-01-02 in Jakarta (UTC+7).
    expect(dateTimeAttr('2026-01-01T23:00:00Z')).toBe('2026-01-02');
  });
});

describe('replaceYear', () => {
  test('replaces the {year} placeholder with the current year', () => {
    const currentYear = new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date());
    expect(replaceYear('© {year} ALMAIDAH')).toBe(`© ${currentYear} ALMAIDAH`);
  });
});

describe('calendarGrid', () => {
  test('August 2026 starts with 6 blanks then day 1 (Saturday)', () => {
    const { weeks } = calendarGrid('2026-08');
    expect(weeks[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(weeks[weeks.length - 1].includes(31)).toBe(true);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });
});

describe('shiftMonth', () => {
  test('shifts forward and across year boundaries', () => {
    expect(shiftMonth('2026-08', 1)).toBe('2026-09');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  test('shifts backward and across year boundaries', () => {
    expect(shiftMonth('2026-08', -1)).toBe('2026-07');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});
