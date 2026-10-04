import type { NextConfig } from 'next';

const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:8080';

const isDev = process.env.NODE_ENV === 'development';
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');

// CSP without nonces (Next 16 guide "Without Nonces"): nonces force dynamic
// rendering, which our ISR pages cannot afford, and the inline RSC payload
// scripts cannot be hashed. So scripts need 'unsafe-inline'; XSS defence rests
// on server-side HTML sanitising (bluemonday) plus React escaping, while the
// policy closes framing, <base>, <object>, form-action and foreign origins.
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isHttps ? ['upgrade-insecure-requests'] : []),
];

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives.join('; ') },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // fullscreen / picture-in-picture stay allowed for YouTube embeds.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // HSTS only for an https site URL (build-time env); a reverse proxy may
  // also set it.
  ...(isHttps
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
    ];
  },
  images: {
    // Media URLs from the API are relative (/uploads/…) and reach Go through
    // the rewrite above, so they are local sources.
    localPatterns: [
      { pathname: '/uploads/**', search: '' },
      { pathname: '/brand/**', search: '' },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' },
    ],
    qualities: [75],
    formats: ['image/avif', 'image/webp'],
  },
  poweredByHeader: false,
};

export default nextConfig;
