import { describe, expect, test } from 'bun:test';

import { CHANGE_PASSWORD_PATH, postLoginPath, safeNext } from './safe-next';

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

  test('never returns to the forced password change page', () => {
    expect(safeNext('/admin/ganti-password')).toBe('/admin');
    expect(safeNext('/admin/ganti-password?x=1')).toBe('/admin');
    expect(safeNext('/admin/ganti-passwordx')).toBe('/admin/ganti-passwordx');
  });
});

describe('postLoginPath', () => {
  test('flagged users go to the change page, others to next', () => {
    expect(postLoginPath({ must_change_password: true }, '/admin/media')).toBe(
      CHANGE_PASSWORD_PATH,
    );
    expect(postLoginPath({ must_change_password: false }, '/admin/media')).toBe(
      '/admin/media',
    );
    expect(postLoginPath({ must_change_password: false }, '//evil')).toBe(
      '/admin',
    );
  });
});
