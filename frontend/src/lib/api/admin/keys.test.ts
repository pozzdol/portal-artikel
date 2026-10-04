import { describe, expect, test } from 'bun:test';

import { ApiClientError } from '@/lib/api/client';
import { shouldRetry } from '@/lib/query/provider';

import { cleanParams, qk } from './keys';
import { normalizeMediaIds } from './media';

describe('query keys', () => {
  test('lists share a family prefix and drop empty params', () => {
    expect(qk.articles.list({ q: '', status: 'draft', page: 1 })).toEqual([
      'admin',
      'articles',
      'list',
      { status: 'draft', page: 1 },
    ]);
    expect(qk.articles.list({ q: undefined })).toEqual(qk.articles.list());
    expect(qk.articles.detail(5).slice(0, 2)).toEqual([...qk.articles.all]);
    expect(qk.snippets.list('faq')).toEqual([
      'admin',
      'snippets',
      'list',
      'faq',
    ]);
    expect(cleanParams({ a: null, b: 0, c: false })).toEqual({
      b: 0,
      c: false,
    });
  });

  test('media ids are normalised before keying', () => {
    expect(normalizeMediaIds([3, null, 1, 3, undefined, 0, -2])).toEqual([
      1, 3,
    ]);
    expect(qk.media.byIds([1, 3])).toEqual(['admin', 'media', 'by-ids', '1,3']);
  });
});

describe('query retry policy', () => {
  test('retries only network/5xx errors, at most twice', () => {
    expect(shouldRetry(0, new ApiClientError(500, 'internal_error', 'x'))).toBe(
      true,
    );
    expect(shouldRetry(1, new ApiClientError(0, 'network_error', 'x'))).toBe(
      true,
    );
    expect(shouldRetry(2, new ApiClientError(503, 'internal_error', 'x'))).toBe(
      false,
    );
    expect(shouldRetry(0, new ApiClientError(404, 'not_found', 'x'))).toBe(
      false,
    );
    expect(
      shouldRetry(0, new ApiClientError(401, 'unauthenticated', 'x')),
    ).toBe(false);
    expect(shouldRetry(0, new Error('x'))).toBe(false);
  });
});
