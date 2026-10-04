import { describe, expect, test } from 'bun:test';

import { safeNext } from './safe-next';

describe('safeNext', () => {
  test('keeps admin paths with query and hash', () => {
    expect(safeNext('/admin')).toBe('/admin');
    expect(safeNext('/admin/articles?page=2&status=draft')).toBe(
      '/admin/articles?page=2&status=draft',
    );
    expect(safeNext('/admin/articles/12#seo')).toBe('/admin/articles/12#seo');
    expect(safeNext(['/admin/media', '/x'])).toBe('/admin/media');
  });

  test('rejects missing, external and protocol-relative targets', () => {
    for (const bad of [
      null,
      undefined,
      '',
      'admin',
      'https://evil.example/admin',
      '//evil.example/admin',
      '/\\evil.example',
      '/admin\\..\\x',
      'javascript:alert(1)',
      '/admin\n/x',
    ]) {
      expect(safeNext(bad)).toBe('/admin');
    }
  });

  test('rejects paths outside /admin, including after normalization', () => {
    expect(safeNext('/')).toBe('/admin');
    expect(safeNext('/administrator')).toBe('/admin');
    expect(safeNext('/admin/../berita/x')).toBe('/admin');
    expect(safeNext('/berita/x', '/admin/profile')).toBe('/admin/profile');
  });

  test('never returns to the login page', () => {
    expect(safeNext('/admin/login')).toBe('/admin');
    expect(safeNext('/admin/login?next=/admin')).toBe('/admin');
    expect(safeNext('/admin/loginx')).toBe('/admin/loginx');
  });
});
