import { describe, expect, test } from 'bun:test';

import {
  breadcrumbFor,
  filterNav,
  hasAnyPermission,
  isNavActive,
  NAV_GROUPS,
} from './nav';

describe('nav', () => {
  test('hasAnyPermission is any-of', () => {
    expect(
      hasAnyPermission(['authors.manage'], ['users.manage', 'authors.manage']),
    ).toBe(true);
    expect(hasAnyPermission([], ['users.manage'])).toBe(false);
    expect(hasAnyPermission(undefined, undefined)).toBe(true);
  });

  test('filterNav drops forbidden items and empty groups', () => {
    const groups = filterNav(NAV_GROUPS, ['articles.read', 'media.manage']);
    expect(groups.map((g) => g.label)).toEqual(['Konten']);
    expect(groups[0].items.map((i) => i.href)).toEqual([
      '/admin/articles',
      '/admin/media',
    ]);
  });

  test('isNavActive', () => {
    expect(isNavActive('/admin', '/admin')).toBe(true);
    expect(isNavActive('/admin/articles', '/admin')).toBe(false);
    expect(isNavActive('/admin/articles/12', '/admin/articles')).toBe(true);
    expect(isNavActive('/admin/articlesx', '/admin/articles')).toBe(false);
  });

  test('breadcrumbFor', () => {
    expect(breadcrumbFor('/admin')).toEqual([{ label: 'Dasbor' }]);
    expect(breadcrumbFor('/admin/articles')).toEqual([
      { label: 'Konten' },
      { label: 'Artikel' },
    ]);
    expect(breadcrumbFor('/admin/articles/new')).toEqual([
      { label: 'Konten' },
      { label: 'Artikel', href: '/admin/articles' },
      { label: 'Baru' },
    ]);
    expect(breadcrumbFor('/admin/events/5').at(-1)).toEqual({
      label: 'Sunting',
    });
    expect(breadcrumbFor('/admin/profile')).toEqual([{ label: 'Profil saya' }]);
  });
});
