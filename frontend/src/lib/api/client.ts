// Browser API client for the admin CMS (docs/05-api.md §1, §3–4).
//
// - Same-origin base `/api/v1` (Next rewrites it to the Go API).
// - JSON bodies unless the body is FormData.
// - Non-GET requests send `X-CSRF-Token` read from the readable `csrf_token`
//   cookie (double-submit, backend/internal/middleware/csrf.go).
// - A 401 `token_expired` triggers one module-level single-flight
//   POST /auth/refresh (the refresh cookie is scoped to /api/v1/auth), then
//   the request is retried exactly once with the rotated CSRF cookie. If the
//   refresh fails, the request rejects with ApiClientError(401,
//   'unauthenticated') and `admin:unauthenticated` is dispatched on window.
// - Nothing here is fetch-cached (`cache: 'no-store'`).

import type { ListMeta } from './admin/types';

export const API_BASE = '/api/v1';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'X-CSRF-Token';
/** Dispatched on `window` when the session is gone (refresh failed / 401 unauthenticated). */
export const UNAUTHENTICATED_EVENT = 'admin:unauthenticated';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue =
  string | number | boolean | null | undefined | readonly (string | number)[];
export type QueryParams = Record<string, QueryValue>;

export type RequestOptions = {
  method?: HttpMethod;
  /** JSON-serialised unless it is FormData. `undefined` sends no body. */
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Do not attempt the token_expired refresh/retry (used by /auth/* calls). */
  skipRefresh?: boolean;
  /** Do not dispatch `admin:unauthenticated` on a final 401. */
  silentUnauthenticated?: boolean;
};

export type ApiResponse<T> = {
  data: T;
  meta?: ListMeta;
  status: number;
  headers: Headers;
};

export type ApiErrorFields = Record<string, string>;

/** Error thrown for every non-2xx response and for network failures (status 0). */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: ApiErrorFields;
  /** Seconds from the Retry-After header (429). */
  readonly retryAfter?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: ApiErrorFields,
    retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}

export function isApiClientError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError;
}

const NETWORK_MESSAGE =
  'Tidak dapat terhubung ke server. Periksa koneksi Anda.';
const GENERIC_MESSAGE = 'Terjadi kesalahan pada server.';
const UNAUTH_MESSAGE = 'Sesi Anda telah berakhir. Silakan masuk kembali.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

export function readCsrfToken(): string | null {
  return readCookie(CSRF_COOKIE);
}

/** Serialises query params: skips null/undefined/'' and joins arrays with commas. */
export function buildQuery(query?: QueryParams): string {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      sp.set(key, value.join(','));
    } else {
      sp.set(key, String(value));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function buildUrl(path: string, query?: QueryParams): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}${buildQuery(query)}`;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
  const at = Date.parse(value);
  if (Number.isNaN(at)) return undefined;
  return Math.max(1, Math.ceil((at - Date.now()) / 1000));
}

type ErrorEnvelope = {
  error?: { code?: string; message?: string; fields?: ApiErrorFields };
};

function errorFromBody(
  status: number,
  body: unknown,
  retryAfterHeader: string | null,
): ApiClientError {
  const env = (body && typeof body === 'object' ? body : {}) as ErrorEnvelope;
  const e = env.error;
  const code = e?.code || (status >= 500 ? 'internal_error' : 'http_error');
  const message = e?.message || GENERIC_MESSAGE;
  return new ApiClientError(
    status,
    code,
    message,
    e?.fields && Object.keys(e.fields).length > 0 ? e.fields : undefined,
    parseRetryAfter(retryAfterHeader),
  );
}

function isAbort(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'AbortError'
  );
}

export function notifyUnauthenticated(): void {
  if (
    typeof window !== 'undefined' &&
    typeof window.dispatchEvent === 'function'
  ) {
    window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
  }
}

function unauthenticatedError(): ApiClientError {
  return new ApiClientError(401, 'unauthenticated', UNAUTH_MESSAGE);
}

// ---------------------------------------------------------------------------
// Single-flight refresh
// ---------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

/**
 * POST /auth/refresh once for all concurrent callers. Resolves true when new
 * cookies were issued. Never rejects.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        const csrf = readCsrfToken();
        if (csrf) headers[CSRF_HEADER] = csrf;
        const res = await fetch(buildUrl('/auth/refresh'), {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          cache: 'no-store',
        });
        return res.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ---------------------------------------------------------------------------
// fetch-based request
// ---------------------------------------------------------------------------

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  };
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (method !== 'GET') {
    const csrf = readCsrfToken();
    if (csrf) headers[CSRF_HEADER] = csrf;
  }
  try {
    return await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body,
      signal: opts.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiClientError(0, 'network_error', NETWORK_MESSAGE);
  }
}

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Low-level request. `path` is relative to /api/v1 (e.g. '/admin/articles').
 * Resolves with the `data` (and `meta`) of the envelope; 204 → data undefined.
 */
export async function request<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<ApiResponse<T>> {
  let res = await send(path, opts);
  let body = await readJson(res);

  if (res.status === 401 && !opts.skipRefresh) {
    const code = (body as ErrorEnvelope | undefined)?.error?.code;
    if (code === 'token_expired') {
      const ok = await refreshSession();
      if (!ok) {
        if (!opts.silentUnauthenticated) notifyUnauthenticated();
        throw unauthenticatedError();
      }
      res = await send(path, opts);
      body = await readJson(res);
    }
  }

  if (!res.ok) {
    const err = errorFromBody(res.status, body, res.headers.get('Retry-After'));
    if (
      res.status === 401 &&
      !opts.silentUnauthenticated &&
      err.code !== 'invalid_credentials'
    ) {
      notifyUnauthenticated();
      throw err.code === 'token_expired' ? unauthenticatedError() : err;
    }
    throw err;
  }

  const env = (body ?? {}) as { data?: T; meta?: ListMeta };
  return {
    data: env.data as T,
    meta: env.meta,
    status: res.status,
    headers: res.headers,
  };
}

// ---------------------------------------------------------------------------
// XHR upload (progress events)
// ---------------------------------------------------------------------------

export type UploadOptions = {
  /** 0..1 fraction of the request body sent. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  method?: 'POST' | 'PUT';
};

type XhrResult = { status: number; body: unknown; retryAfter: string | null };

function xhrSend(
  path: string,
  formData: FormData,
  opts: UploadOptions,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method ?? 'POST', buildUrl(path));
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    const csrf = readCsrfToken();
    if (csrf) xhr.setRequestHeader(CSRF_HEADER, csrf);
    if (opts.onProgress) {
      const cb = opts.onProgress;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) cb(e.loaded / e.total);
      };
    }
    const onAbort = () => xhr.abort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    xhr.onload = () => {
      opts.signal?.removeEventListener('abort', onAbort);
      let body: unknown;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        body = undefined;
      }
      resolve({
        status: xhr.status,
        body,
        retryAfter: xhr.getResponseHeader('Retry-After'),
      });
    };
    xhr.onerror = () => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(new ApiClientError(0, 'network_error', NETWORK_MESSAGE));
    };
    xhr.onabort = () => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Unggahan dibatalkan.', 'AbortError'));
    };
    if (opts.signal?.aborted) {
      xhr.abort();
      return;
    }
    xhr.send(formData);
  });
}

/** Multipart upload with progress; same CSRF/refresh semantics as request(). */
export async function upload<T>(
  path: string,
  formData: FormData,
  opts: UploadOptions = {},
): Promise<ApiResponse<T>> {
  let r = await xhrSend(path, formData, opts);
  if (
    r.status === 401 &&
    (r.body as ErrorEnvelope | undefined)?.error?.code === 'token_expired'
  ) {
    const ok = await refreshSession();
    if (!ok) {
      notifyUnauthenticated();
      throw unauthenticatedError();
    }
    opts.onProgress?.(0);
    r = await xhrSend(path, formData, opts);
  }
  if (r.status < 200 || r.status >= 300) {
    const err = errorFromBody(r.status, r.body, r.retryAfter);
    if (r.status === 401) notifyUnauthenticated();
    throw err;
  }
  const env = (r.body ?? {}) as { data?: T; meta?: ListMeta };
  return {
    data: env.data as T,
    meta: env.meta,
    status: r.status,
    headers: new Headers(),
  };
}

// ---------------------------------------------------------------------------
// Convenience facade
// ---------------------------------------------------------------------------

type Opts = Omit<RequestOptions, 'method' | 'body' | 'query'>;

export const adminApi = {
  get: <T>(path: string, query?: QueryParams, opts?: Opts) =>
    request<T>(path, { ...opts, method: 'GET', query }),
  post: <T>(path: string, body?: unknown, opts?: Opts) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Opts) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Opts) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  del: <T = void>(path: string, opts?: Opts) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
  upload,
};

/** Test hook: forget any in-flight refresh. */
export function __resetClientStateForTests(): void {
  refreshPromise = null;
}
