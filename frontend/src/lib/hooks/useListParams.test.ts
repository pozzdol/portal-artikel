import { describe, expect, test } from 'bun:test';

import { parseListParams, serializeListParams } from './useListParams';

const defaults = {
  page: 1,
  q: '',
  status: undefined,
  trashed: false,
  sort: '-updated_at',
};

describe('list params', () => {
  test('parse uses default types', () => {
    const p = parseListParams(
      defaults,
      new URLSearchParams('page=3&q=adab&trashed=true&x=1'),
    );
    expect(p).toEqual({
      page: 3,
      q: 'adab',
      status: undefined,
      trashed: true,
      sort: '-updated_at',
    });
    const bad = parseListParams(
      defaults,
      new URLSearchParams('page=abc&trashed=maybe'),
    );
    expect(bad.page).toBe(1);
    expect(bad.trashed).toBe(false);
  });

  test('serialize omits defaults/empties and keeps foreign keys', () => {
    const qs = serializeListParams(
      defaults,
      { page: 1, q: 'adab', status: 'draft', trashed: false, sort: '-title' },
      new URLSearchParams('keep=1&page=4'),
    );
    expect(qs).toBe('keep=1&q=adab&status=draft&sort=-title');
    expect(serializeListParams(defaults, {})).toBe('');
  });
});
