import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  optionalInt,
  optionalSlug,
  optionalText,
  optionalUrl,
  requiredId,
  requiredText,
} from './schemas';

describe('form schemas', () => {
  const s = z.object({
    title: requiredText(10),
    excerpt: optionalText(20),
    slug: optionalSlug,
    url: optionalUrl(),
    category_id: requiredId,
    year: optionalInt(1900, 2100),
  });

  test('empty optional strings become null / undefined', () => {
    const out = s.parse({
      title: ' Judul ',
      excerpt: '  ',
      slug: '',
      url: '',
      category_id: 3,
      year: '',
    });
    expect(out).toEqual({
      title: 'Judul',
      excerpt: null,
      slug: undefined,
      url: null,
      category_id: 3,
      year: null,
    });
  });

  test('Indonesian messages match the backend validator', () => {
    const r = s.safeParse({
      title: '',
      slug: 'Bad Slug',
      url: 'ftp://x',
      category_id: null,
      year: 1800,
    });
    expect(r.success).toBe(false);
    const msgs = Object.fromEntries(
      (r.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]),
    );
    expect(msgs.title).toBe('Wajib diisi.');
    expect(msgs.slug).toBe('Hanya huruf kecil, angka, dan tanda hubung.');
    expect(msgs.url).toBe('Format URL tidak valid.');
    expect(msgs.category_id).toBe('Wajib diisi.');
    expect(msgs.year).toBe('Minimal 1900.');
  });
});
