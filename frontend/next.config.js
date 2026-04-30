const path = require('path');
const withNextIntl = require('next-intl/plugin')(
  './i18n.ts'
);

/**
 * Locales and defaultLocale live in ./i18n.ts (ku first, default Kurdish Sorani).
 * With `output: 'export'`, Next.js built-in `i18n` in next.config is not used;
 * routing is `[locale]` + next-intl.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  swcMinify: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

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
      { protocol: 'http', hostname: '127.0.0.1', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
      { protocol: 'https', hostname: '*.carwiseiq.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.koyeb.app', pathname: '/**' },
      { protocol: 'https', hostname: '*.railway.app', pathname: '/**' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com', pathname: '/**' },
    ],
  },

  // Reduce memory during build (avoid heap OOM on Cloudflare)
  productionBrowserSourceMaps: false,

  // Security/cache headers: use platform config (e.g. Cloudflare _headers) with `output: 'export'`
  // — Next.js does not apply custom `headers()` to static export output.

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
    // lucide-react removed - can cause "Unsupported Server Component type: Module" with static export
    optimizePackageImports: [
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
