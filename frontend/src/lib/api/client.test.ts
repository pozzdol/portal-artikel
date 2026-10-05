import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import {
  __resetClientStateForTests,
  adminApi,
  ApiClientError,
  buildQuery,
  PASSWORD_CHANGE_REQUIRED_EVENT,
  request,
  UNAUTHENTICATED_EVENT,
} from './client';

type Call = { url: string; init: RequestInit };

const g = globalThis as unknown as {
  fetch: typeof fetch;
  document?: { cookie: string };
  window?: EventTarget;
};

const realFetch = g.fetch;
let calls: Call[] = [];
let unauthEvents = 0;
let pwEvents = 0;

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function headerOf(c: Call, name: string): string | undefined {
  const h = c.init.headers as Record<string, string> | undefined;
  return h?.[name];
}

/** Install a fetch mock driven by a handler; records every call. */
function installFetch(
  handler: (c: Call, n: number) => Response | Promise<Response>,
) {
  g.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const c = { url: String(input), init: init ?? {} };
    calls.push(c);
    return handler(c, calls.length);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
  unauthEvents = 0;
  pwEvents = 0;
  __resetClientStateForTests();
  g.document = { cookie: 'theme=dark; csrf_token=csrf-1' };
  const win = new EventTarget();
  win.addEventListener(UNAUTHENTICATED_EVENT, () => {
    unauthEvents++;
  });
  win.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, () => {
    pwEvents++;
  });
  g.window = win;
});

afterEach(() => {
  g.fetch = realFetch;
  delete g.document;
  delete g.window;
});

describe('request basics', () => {
  test('GET builds the URL, sends no CSRF header, unwraps data + meta', async () => {
    installFetch(() =>
      json(200, {
        data: [{ id: 1 }],
        meta: { page: 2, per_page: 5, total: 6, total_pages: 2 },
      }),
    );
    const res = await adminApi.get<{ id: number }[]>('/admin/tags', {
      q: 'fik',
      page: 2,
      empty: '',
      none: undefined,
      ids: [3, 1],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/v1/admin/tags?q=fik&page=2&ids=3%2C1');
    expect(calls[0].init.method).toBe('GET');
    expect(headerOf(calls[0], 'X-CSRF-Token')).toBeUndefined();
    expect(res.data).toEqual([{ id: 1 }]);
    expect(res.meta?.total).toBe(6);
  });

  test('non-GET sends X-CSRF-Token from the cookie and a JSON body', async () => {
    installFetch(() => json(201, { data: { id: 9 } }));
    await adminApi.post('/admin/tags', { name: 'Reuni' });
    await adminApi.put('/admin/tags/9', { name: 'Reuni 2' });
    installFetch(() => new Response(null, { status: 204 }));
    const del = await adminApi.del('/admin/tags/9');
    expect(del.data).toBeUndefined();
    for (const c of calls) {
      expect(headerOf(c, 'X-CSRF-Token')).toBe('csrf-1');
    }
    expect(headerOf(calls[0], 'Content-Type')).toBe('application/json');
    expect(calls[0].init.body).toBe(JSON.stringify({ name: 'Reuni' }));
    expect(calls[2].init.method).toBe('DELETE');
    expect(calls[2].init.body).toBeUndefined();
  });

  test('FormData bodies are passed through without a JSON content type', async () => {
    installFetch(() => json(201, { data: { id: 1 } }));
    const fd = new FormData();
    fd.append('file', new Blob(['x']), 'x.png');
    await request('/admin/media', { method: 'POST', body: fd });
    expect(calls[0].init.body).toBe(fd);
    expect(headerOf(calls[0], 'Content-Type')).toBeUndefined();
  });

  test('buildQuery skips empty values', () => {
    expect(buildQuery({ a: undefined, b: null, c: '', d: [] })).toBe('');
    expect(buildQuery({ trashed: false, n: 0 })).toBe('?trashed=false&n=0');
  });
});

describe('errors', () => {
  test('422 exposes fields; message from the envelope', async () => {
    installFetch(() =>
      json(422, {
        error: {
          code: 'validation_failed',
          message: 'Data yang dikirim tidak valid.',
          fields: { title: 'Wajib diisi.' },
        },
      }),
    );
    const err = (await adminApi
      .post('/admin/articles', {})
      .catch((e) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('validation_failed');
    expect(err.fields).toEqual({ title: 'Wajib diisi.' });
    expect(unauthEvents).toBe(0);
  });

  test('429 carries retryAfter seconds from the Retry-After header', async () => {
    installFetch(() =>
      json(
        429,
        {
          error: {
            code: 'rate_limited',
            message: 'Terlalu banyak permintaan. Coba lagi nanti.',
          },
        },
        { 'Retry-After': '42' },
      ),
    );
    const err = (await adminApi
      .post(
        '/auth/login',
        { email: 'a@b.c', password: 'x' },
        { skipRefresh: true },
      )
      .catch((e) => e)) as ApiClientError;
    expect(err.status).toBe(429);
    expect(err.code).toBe('rate_limited');
    expect(err.retryAfter).toBe(42);
  });

  test('invalid_credentials does not refresh or dispatch the event', async () => {
    installFetch(() =>
      json(401, {
        error: {
          code: 'invalid_credentials',
          message: 'Email atau kata sandi salah.',
        },
      }),
    );
    const err = (await adminApi
      .post('/auth/login', {})
      .catch((e) => e)) as ApiClientError;
    expect(err.code).toBe('invalid_credentials');
    expect(calls).toHaveLength(1);
    expect(unauthEvents).toBe(0);
  });

  test('network failure → status 0 network_error', async () => {
    g.fetch = mock(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const err = (await adminApi
      .get('/admin/tags')
      .catch((e) => e)) as ApiClientError;
    expect(err.status).toBe(0);
    expect(err.code).toBe('network_error');
  });

  test('non-JSON 502 falls back to a generic error', async () => {
    installFetch(
      () => new Response('<html>Bad gateway</html>', { status: 502 }),
    );
    const err = (await adminApi
      .get('/admin/tags')
      .catch((e) => e)) as ApiClientError;
    expect(err.status).toBe(502);
    expect(err.code).toBe('internal_error');
  });
});

describe('token_expired refresh', () => {
  const expired = () =>
    json(401, {
      error: { code: 'token_expired', message: 'Sesi telah kedaluwarsa.' },
    });

  test('single-flight refresh for concurrent requests, each retried once with the rotated CSRF', async () => {
    let refreshed = false;
    installFetch(async (c) => {
      if (c.url === '/api/v1/auth/refresh') {
        // Let the other request hit its 401 before the refresh resolves.
        await new Promise((r) => setTimeout(r, 5));
        refreshed = true;
        g.document!.cookie = 'theme=dark; csrf_token=csrf-2';
        return json(200, { data: { user: { id: 1 } } });
      }
      if (!refreshed) return expired();
      return json(200, { data: { ok: c.url } });
    });

    const [a, b] = await Promise.all([
      adminApi.get<{ ok: string }>('/admin/articles'),
      adminApi.put<{ ok: string }>('/admin/tags/1', { name: 'x' }),
    ]);

    expect(a.data.ok).toBe('/api/v1/admin/articles');
    expect(b.data.ok).toBe('/api/v1/admin/tags/1');
    const refreshCalls = calls.filter((c) => c.url === '/api/v1/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
    expect(refreshCalls[0].init.method).toBe('POST');
    const puts = calls.filter((c) => c.url === '/api/v1/admin/tags/1');
    expect(puts).toHaveLength(2);
    expect(headerOf(puts[0], 'X-CSRF-Token')).toBe('csrf-1');
    expect(headerOf(puts[1], 'X-CSRF-Token')).toBe('csrf-2');
    expect(
      calls.filter((c) => c.url === '/api/v1/admin/articles'),
    ).toHaveLength(2);
    expect(unauthEvents).toBe(0);
  });

  test('retries only once: a second token_expired becomes unauthenticated', async () => {
    installFetch((c) =>
      c.url === '/api/v1/auth/refresh' ? json(200, { data: {} }) : expired(),
    );
    const err = (await adminApi
      .get('/admin/articles')
      .catch((e) => e)) as ApiClientError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('unauthenticated');
    expect(
      calls.filter((c) => c.url === '/api/v1/admin/articles'),
    ).toHaveLength(2);
    expect(calls.filter((c) => c.url === '/api/v1/auth/refresh')).toHaveLength(
      1,
    );
    expect(unauthEvents).toBe(1);
  });

  test('refresh failure rejects all waiters with 401 unauthenticated and dispatches admin:unauthenticated', async () => {
    installFetch(async (c) => {
      if (c.url === '/api/v1/auth/refresh') {
        await new Promise((r) => setTimeout(r, 5));
        return json(401, {
          error: { code: 'unauthenticated', message: 'Silakan masuk.' },
        });
      }
      return expired();
    });
    const results = await Promise.allSettled([
      adminApi.get('/admin/articles'),
      adminApi.get('/admin/dashboard'),
    ]);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      const err = (r as PromiseRejectedResult).reason as ApiClientError;
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('unauthenticated');
    }
    expect(calls.filter((c) => c.url === '/api/v1/auth/refresh')).toHaveLength(
      1,
    );
    // No retry of the original requests after a failed refresh.
    expect(calls.filter((c) => c.url !== '/api/v1/auth/refresh')).toHaveLength(
      2,
    );
    expect(unauthEvents).toBe(2);
  });

  test('plain 401 unauthenticated dispatches the event without refreshing', async () => {
    installFetch(() =>
      json(401, {
        error: { code: 'unauthenticated', message: 'Silakan masuk.' },
      }),
    );
    const err = (await adminApi
      .get('/auth/me')
      .catch((e) => e)) as ApiClientError;
    expect(err.code).toBe('unauthenticated');
    expect(calls).toHaveLength(1);
    expect(unauthEvents).toBe(1);
  });

  test('skipRefresh + silentUnauthenticated leave token_expired alone', async () => {
    installFetch(() => expired());
    const err = (await adminApi
      .post('/auth/logout', undefined, {
        skipRefresh: true,
        silentUnauthenticated: true,
      })
      .catch((e) => e)) as ApiClientError;
    expect(err.code).toBe('token_expired');
    expect(calls).toHaveLength(1);
    expect(unauthEvents).toBe(0);
  });

  test('403 password_change_required dispatches its event once, without retry', async () => {
    installFetch(() =>
      json(403, {
        error: {
          code: 'password_change_required',
          message: 'Anda wajib mengganti kata sandi terlebih dahulu.',
        },
      }),
    );
    const err = (await adminApi
      .get('/admin/articles')
      .catch((e) => e)) as ApiClientError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('password_change_required');
    expect(calls).toHaveLength(1);
    expect(pwEvents).toBe(1);
    expect(unauthEvents).toBe(0);
  });

  test('other 403s do not dispatch the password event', async () => {
    installFetch(() =>
      json(403, { error: { code: 'forbidden', message: 'Tidak boleh.' } }),
    );
    await adminApi.get('/admin/articles').catch(() => {});
    expect(pwEvents).toBe(0);
  });
});
