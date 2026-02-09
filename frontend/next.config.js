const path = require('path');
const withNextIntl = require('next-intl/plugin')(
  './i18n.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  swcMinify: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Production performance: remove console.* and minify
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000',
  },

  // Static export for Cloudflare Pages (no SSR)
  output: 'export',

  // Cloudflare Pages: unoptimized required (no Node image optimizer at edge)
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/**' },
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/**' },
    ],
  },

  // Reduce memory during build (avoid heap OOM on Cloudflare)
  productionBrowserSourceMaps: false,

  // OPTIMIZED: Add caching and security headers (CSP, HSTS, etc.)
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
    ];
    if (isProd) {
      securityHeaders.push(
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://carwiseiq.com; connect-src 'self' https://*.supabase.co https://*.koyeb.app https://*.railway.app https://api.carwiseiq.com; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
        }
      );
    }
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

  // Webpack: dev-friendly caching, watch options, and module resolution
  webpack: (config, { dev, isServer }) => {
    // Watch options: reduce unnecessary recompiles, batch rapid changes
    config.watchOptions = {
      ...config.watchOptions,
      aggregateTimeout: 300,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.log',
        'C:/pagefile.sys',
        'C:/swapfile.sys',
        'C:/hiberfil.sys',
        'C:/DumpStack.log.tmp',
      ],
    };

    // In dev: cache node_modules resolution to avoid repeated work between rebuilds
    if (dev) {
      config.snapshot = {
        ...config.snapshot,
        managedPaths: [path.join(__dirname, 'node_modules')],
      };
    }

    // Production: deterministic module IDs (smaller cache, less memory churn)
    if (!dev && config.optimization) {
      config.optimization.moduleIds = 'deterministic'
    }

    return config
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-select',
      '@radix-ui/react-dropdown-menu',
      'recharts',
      'framer-motion',
    ],
  },

  // Compression
  compress: true,

  // Power optimizations
  poweredByHeader: false,
};

// withNextIntl sets env._next_intl_trailing_slash to undefined when trailingSlash is false;
// Next.js validates env values as strings, so we ensure it is always a string.
const config = withNextIntl(nextConfig);
if (config.env && (config.env._next_intl_trailing_slash == null || config.env._next_intl_trailing_slash === '')) {
  config.env._next_intl_trailing_slash = nextConfig.trailingSlash ? 'true' : 'false';
}
module.exports = config;
