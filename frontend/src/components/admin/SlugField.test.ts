import { describe, expect, test } from 'bun:test';

import { isValidSlug, slugify } from './SlugField';

// Same cases as backend/internal/slugutil/slugutil_test.go (TestMake) — the two
// implementations must agree exactly.
describe('slugify', () => {
  const cases: Record<string, string> = {
    'Menjaga Keikhlasan di Tengah Derasnya Arus Informasi':
      'menjaga-keikhlasan-di-tengah-derasnya-arus-informasi',
    "Qur'an": 'quran',
    'Al-Qur’an dan Ḥadīṡ': 'al-quran-dan-hadi',
    'Café Déjà Vu': 'cafe-deja-vu',
    '  Syarat & Ketentuan  ': 'syarat-ketentuan',
    'Dr. H. Asep Suryana': 'dr-h-asep-suryana',
    'Reuni 2026!!!': 'reuni-2026',
    'Straße Œuvre': 'strasse-oeuvre',
    '---': '',
    '': '',
  };

  for (const [input, want] of Object.entries(cases)) {
    test(`slugify(${JSON.stringify(input)}) === ${JSON.stringify(want)}`, () => {
      expect(slugify(input)).toBe(want);
    });
  }

  test('truncates to 160 chars without a trailing dash', () => {
    const s = slugify('kata panjang '.repeat(40));
    expect(s.length).toBeLessThanOrEqual(160);
    expect(isValidSlug(s)).toBe(true);
    expect(s.endsWith('-')).toBe(false);
  });

  test('is idempotent', () => {
    const s = slugify('Menjaga Keikhlasan!!');
    expect(slugify(s)).toBe(s);
  });
});

describe('isValidSlug', () => {
  test.each(['a', 'abc-123', 'kajian'])('%s is valid', (s) => {
    expect(isValidSlug(s)).toBe(true);
  });

  test.each(['', '-a', 'a-', 'a--b', 'A', 'a_b', 'a b', 'a'.repeat(161)])(
    '%s is invalid',
    (s) => {
      expect(isValidSlug(s)).toBe(false);
    },
  );
});
