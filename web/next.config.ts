import type { NextConfig } from 'next';

const API_URL = process.env.API_URL || 'http://localhost:4000';

const config: NextConfig = {
  // The browser only talks to Next.js; /api/* is proxied to the Bun API so cookies stay same-origin.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default config;
