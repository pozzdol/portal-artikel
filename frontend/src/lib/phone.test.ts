import { describe, expect, test } from 'bun:test';

import { formatPhone, normalizePhone, phoneE164 } from './phone';

describe('normalizePhone', () => {
  test('accepts common spellings', () => {
    for (const raw of [
      '0812-3456-789',
      '+62 812 3456 789',
      '628123456789',
      '8123456789',
      ' (0812) 3456.789 ',
    ]) {
      expect(normalizePhone(raw)).toBe('8123456789');
    }
  });

  test('rejects invalid input', () => {
    for (const raw of [
      '',
      '08abc3456789',
      '+12025550123',
      '0723456789',
      '0821',
      '081234567891234567',
      '++62812345678',
    ]) {
      expect(normalizePhone(raw)).toBeNull();
    }
  });
});

describe('formatting', () => {
  test('formatPhone groups digits', () => {
    expect(formatPhone('8123456789')).toBe('+62 812-3456-789');
    expect(formatPhone(null)).toBe('');
  });
  test('phoneE164', () => {
    expect(phoneE164('8123456789')).toBe('+628123456789');
  });
});
