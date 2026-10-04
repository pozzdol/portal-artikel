import { describe, expect, test } from 'bun:test';

import { ApiClientError } from '@/lib/api/client';

import {
  MAX_UPLOAD_BYTES,
  MSG_BAD_TYPE,
  MSG_EMPTY,
  MSG_TOO_LARGE,
  acceptedMimes,
  formatBytes,
  inputAccept,
  precheckFile,
  uploadErrorMessage,
} from './upload-rules';

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe('precheckFile', () => {
  test('accepts the four whitelisted image types', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
      expect(precheckFile(f('x', t))).toBeNull();
    }
  });

  test('rejects other types', () => {
    expect(precheckFile(f('a.svg', 'image/svg+xml'))).toBe(MSG_BAD_TYPE);
    expect(precheckFile(f('a.pdf', 'application/pdf'))).toBe(MSG_BAD_TYPE);
    expect(precheckFile(f('a.heic', 'image/heic'))).toBe(MSG_BAD_TYPE);
  });

  test('falls back to the extension when MIME is missing', () => {
    expect(precheckFile(f('Foto.JPG', ''))).toBeNull();
    expect(precheckFile(f('foto.webp', ''))).toBeNull();
    expect(precheckFile(f('script.exe', ''))).toBe(MSG_BAD_TYPE);
    expect(precheckFile(f('noext', ''))).toBe(MSG_BAD_TYPE);
  });

  test('size limits', () => {
    expect(precheckFile(f('a.png', 'image/png', MAX_UPLOAD_BYTES))).toBeNull();
    expect(precheckFile(f('a.png', 'image/png', MAX_UPLOAD_BYTES + 1))).toBe(
      MSG_TOO_LARGE,
    );
    expect(precheckFile(f('a.png', 'image/png', 0))).toBe(MSG_EMPTY);
  });

  test('type is checked before size', () => {
    expect(precheckFile(f('a.pdf', 'application/pdf', 10 ** 9))).toBe(
      MSG_BAD_TYPE,
    );
  });

  test('accept filter narrows the whitelist', () => {
    expect(precheckFile(f('a.png', 'image/png'), 'image/gif')).toBe(
      MSG_BAD_TYPE,
    );
    expect(precheckFile(f('a.gif', 'image/gif'), 'image/gif')).toBeNull();
    expect(precheckFile(f('a.gif', 'image/gif'), 'image/*')).toBeNull();
  });
});

describe('acceptedMimes / inputAccept', () => {
  test('defaults and prefixes', () => {
    expect(acceptedMimes()).toHaveLength(4);
    expect(acceptedMimes('image')).toHaveLength(4);
    expect(acceptedMimes('image/webp')).toEqual(['image/webp']);
    expect(acceptedMimes('video')).toHaveLength(4);
    expect(inputAccept()).toBe('image/jpeg,image/png,image/gif,image/webp');
  });
});

describe('uploadErrorMessage', () => {
  test('maps 413 / 415 / network to fixed Indonesian text', () => {
    expect(
      uploadErrorMessage(new ApiClientError(413, 'payload_too_large', 'x')),
    ).toBe(MSG_TOO_LARGE);
    expect(
      uploadErrorMessage(
        new ApiClientError(415, 'unsupported_media_type', 'x'),
      ),
    ).toBe(MSG_BAD_TYPE);
    expect(
      uploadErrorMessage(new ApiClientError(0, 'network_error', 'x')),
    ).toContain('Koneksi');
  });

  test('passes other server messages through', () => {
    expect(
      uploadErrorMessage(
        new ApiClientError(422, 'validation', 'Alt terlalu panjang.'),
      ),
    ).toBe('Alt terlalu panjang.');
  });
});

describe('formatBytes', () => {
  test('units', () => {
    expect(formatBytes(812)).toBe('812 B');
    expect(formatBytes(48 * 1024)).toBe('48 KB');
    expect(formatBytes(1.25 * 1024 * 1024)).toMatch(/^1,[23] MB$/);
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });
});
