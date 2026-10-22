import { afterEach, describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';

import { proxy } from './proxy';

// NextResponse.next({ request: { headers } }) marks overridden upstream
// headers as x-middleware-request-<name>.
const upstream = (res: Response, name: string) =>
  res.headers.get(`x-middleware-request-${name}`);

const SECRET = '0123456789abcdef0123456789abcdef';

function apiRequest(headers: Record<string, string> = {}) {
  return new NextRequest('https://example.test/api/v1/articles', { headers });
}

afterEach(() => {
  delete process.env.FRONTEND_PROXY_SECRET;
  delete process.env.CLIENT_IP_HEADER;
});

describe('proxy client IP hand-off', () => {
  test('without FRONTEND_PROXY_SECRET adds nothing', () => {
    const res = proxy(apiRequest({ 'x-real-ip': '203.0.113.9' }));
    expect(upstream(res, 'x-proxy-secret')).toBeNull();
    expect(upstream(res, 'x-client-ip')).toBeNull();
  });

  test('forwards secret and x-real-ip by default', () => {
    process.env.FRONTEND_PROXY_SECRET = SECRET;
    const res = proxy(apiRequest({ 'x-real-ip': '203.0.113.9' }));
    expect(upstream(res, 'x-proxy-secret')).toBe(SECRET);
    expect(upstream(res, 'x-client-ip')).toBe('203.0.113.9');
  });

  test('reads the configured header and takes the first list entry', () => {
    process.env.FRONTEND_PROXY_SECRET = SECRET;
    process.env.CLIENT_IP_HEADER = 'CF-Connecting-IP';
    const res = proxy(
      apiRequest({
        'cf-connecting-ip': '2001:db8::7, 198.51.100.1',
        'x-real-ip': '6.6.6.6',
      }),
    );
    expect(upstream(res, 'x-client-ip')).toBe('2001:db8::7');
  });

  test('replaces a client-sent x-client-ip', () => {
    process.env.FRONTEND_PROXY_SECRET = SECRET;
    const res = proxy(
      apiRequest({ 'x-client-ip': '6.6.6.6', 'x-real-ip': '203.0.113.9' }),
    );
    expect(upstream(res, 'x-client-ip')).toBe('203.0.113.9');
  });

  test('drops a client-sent x-client-ip when the platform header is missing', () => {
    process.env.FRONTEND_PROXY_SECRET = SECRET;
    const res = proxy(apiRequest({ 'x-client-ip': '6.6.6.6' }));
    expect(upstream(res, 'x-client-ip')).toBeNull();
    expect(res.headers.get('x-middleware-override-headers')).not.toContain(
      'x-client-ip',
    );
  });
});
