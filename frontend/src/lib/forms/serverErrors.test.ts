import { describe, expect, test } from 'bun:test';
import { createFormControl } from 'react-hook-form';

import { ApiClientError } from '@/lib/api/client';

import {
  applyServerErrors,
  apiErrorMessage,
  candidatePaths,
  normalizeFieldKey,
  type Notify,
} from './serverErrors';

type Values = {
  title: string;
  slug: string;
  seo: { title: string | null };
  items: { label: string }[];
  more_link: { label: string; href: string };
  cover_media_id: number | null;
};

function makeForm() {
  return createFormControl<Values>({
    defaultValues: {
      title: '',
      slug: '',
      seo: { title: null },
      items: [{ label: '' }, { label: 'b' }],
      more_link: { label: '', href: '' },
      cover_media_id: null,
    },
  });
}

function recorder() {
  const toasts: { message: string; description?: string }[] = [];
  const notify: Notify = (message, opts) =>
    toasts.push({ message, description: opts?.description });
  return { toasts, notify };
}

describe('field key helpers', () => {
  test('normalizeFieldKey converts validator bracket indices', () => {
    expect(normalizeFieldKey('items[0].label')).toBe('items.0.label');
    expect(normalizeFieldKey('items[1].children[0].label')).toBe(
      'items.1.children.0.label',
    );
  });
  test('candidatePaths yields shrinking suffixes, skipping bare indices', () => {
    expect(candidatePaths('config.more_link.href')).toEqual([
      'config.more_link.href',
      'more_link.href',
      'href',
    ]);
    expect(candidatePaths('items[0].label')).toEqual([
      'items.0.label',
      '0.label',
      'label',
    ]);
  });
});

describe('applyServerErrors', () => {
  test('maps 422 fields into react-hook-form errors and toasts leftovers', () => {
    const form = makeForm();
    const { toasts, notify } = recorder();
    const err = new ApiClientError(
      422,
      'validation_failed',
      'Data yang dikirim tidak valid.',
      {
        title: 'Wajib diisi.',
        'items[1].label': 'Maksimal 80 karakter.',
        'config.more_link.href': 'Format URL tidak valid.',
        cover_media_id: 'Media tidak ditemukan.',
        seo_title: 'Maksimal 200 karakter.',
        mystery: 'Nilai tidak valid.',
      },
    );

    const res = applyServerErrors(form, err, {
      notify,
      fieldMap: { seo_title: 'seo.title' },
    });

    expect(res.handled).toBe(true);
    expect(form.getFieldState('title').error?.message).toBe('Wajib diisi.');
    expect(form.getFieldState('title').error?.type).toBe('server');
    expect(form.getFieldState('items.1.label').error?.message).toBe(
      'Maksimal 80 karakter.',
    );
    expect(form.getFieldState('more_link.href').error?.message).toBe(
      'Format URL tidak valid.',
    );
    // null default still counts as a known field
    expect(form.getFieldState('cover_media_id').error?.message).toBe(
      'Media tidak ditemukan.',
    );
    expect(form.getFieldState('seo.title').error?.message).toBe(
      'Maksimal 200 karakter.',
    );
    expect(res.matched).toEqual({
      title: 'title',
      'items[1].label': 'items.1.label',
      'config.more_link.href': 'more_link.href',
      cover_media_id: 'cover_media_id',
      seo_title: 'seo.title',
    });
    expect(res.unmatched).toEqual({ mystery: 'Nilai tidak valid.' });
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Data yang dikirim tidak valid.');
    expect(toasts[0].description).toContain('mystery: Nilai tidak valid.');
  });

  test('knownFields allows fields whose value is undefined', () => {
    const form = createFormControl<{ extra?: string }>({ defaultValues: {} });
    const { toasts, notify } = recorder();
    applyServerErrors(
      form,
      new ApiClientError(422, 'validation_failed', 'x', {
        extra: 'Wajib diisi.',
      }),
      { notify, knownFields: ['extra'] },
    );
    expect(form.getFieldState('extra').error?.message).toBe('Wajib diisi.');
    expect(toasts).toHaveLength(0);
  });

  test('409 conflict and 403 are toasted, fields untouched', () => {
    const form = makeForm();
    const { toasts, notify } = recorder();
    applyServerErrors(
      form,
      new ApiClientError(409, 'conflict', 'Kategori masih memiliki artikel.'),
      { notify },
    );
    applyServerErrors(
      form,
      new ApiClientError(
        403,
        'forbidden',
        'Anda tidak memiliki izin untuk tindakan ini.',
      ),
      { notify },
    );
    expect(toasts.map((t) => t.message)).toEqual([
      'Kategori masih memiliki artikel.',
      'Anda tidak memiliki izin untuk tindakan ini.',
    ]);
    expect(form.getFieldState('title').error).toBeUndefined();
  });

  test('429 message includes the retry-after seconds', () => {
    const form = makeForm();
    const { toasts, notify } = recorder();
    const err = new ApiClientError(
      429,
      'rate_limited',
      'Terlalu banyak.',
      undefined,
      37,
    );
    applyServerErrors(form, err, { notify });
    expect(toasts[0].message).toBe(
      'Terlalu banyak percobaan. Coba lagi dalam 37 detik.',
    );
    expect(apiErrorMessage(new ApiClientError(429, 'rate_limited', 'x'))).toBe(
      'Terlalu banyak percobaan. Coba lagi nanti.',
    );
  });

  test('401 is silent (the admin gate handles it)', () => {
    const form = makeForm();
    const { toasts, notify } = recorder();
    applyServerErrors(
      form,
      new ApiClientError(401, 'unauthenticated', 'Sesi berakhir.'),
      {
        notify,
      },
    );
    expect(toasts).toHaveLength(0);
  });

  test('non-API errors get a generic toast', () => {
    const form = makeForm();
    const { toasts, notify } = recorder();
    const res = applyServerErrors(form, new Error('boom'), { notify });
    expect(res.handled).toBe(false);
    expect(toasts[0].message).toBe('Terjadi kesalahan yang tidak terduga.');
  });
});
