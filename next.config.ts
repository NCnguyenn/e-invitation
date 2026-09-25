import type { NextConfig } from 'next';

const privateHeaders = [
  { key: 'Cache-Control', value: 'private, no-store' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/login', headers: privateHeaders },
      { source: '/dashboard', headers: privateHeaders },
      { source: '/dashboard/:path*', headers: privateHeaders },
      { source: '/invite/:path*', headers: privateHeaders },
      { source: '/api/auth/:path*', headers: privateHeaders },
      { source: '/api/host/:path*', headers: privateHeaders },
      { source: '/api/guest/:path*', headers: privateHeaders },
    ];
  },
};

export default config;
