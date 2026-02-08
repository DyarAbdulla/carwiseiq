const path = require('path');
const withNextIntl = require('next-intl/plugin')(
  './i18n.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Production performance: remove console.* and minify
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000',
  },

  // OPTIMIZED: Image optimization for maximum performance
  images: {
    formats: ['image/avif', 'image/webp'], // Modern formats first
    deviceSizes: [640, 750, 828, 1080, 1200, 1920], // Reduced sizes for faster loading
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // Cache for 1 year (images are immutable)
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '8000', pathname: '/uploads/**' },
      { protocol: 'http', hostname: 'localhost', port: '55730', pathname: '/uploads/**' },
      { protocol: 'http', hostname: 'localhost', port: '8000', pathname: '/api/car-images/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '8000', pathname: '/uploads/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '55730', pathname: '/uploads/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '8000', pathname: '/api/car-images/**' },
      // Supabase storage domains
      { protocol: 'https', hostname: 'fehkzrrahgyesxzrwlme.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // External CDN for car images
      { protocol: 'https', hostname: 'cdn.iqcars.io', pathname: '/**' },
    ],
    unoptimized: false,
  },

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
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://carwiseiq.com; connect-src 'self' https://*.supabase.co https://api.carwiseiq.com; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
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

    // Only apply custom splitChunks in production builds to avoid vendor-chunks errors in dev
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for large libraries
            recharts: {
              name: 'recharts',
              test: /[\\/]node_modules[\\/](recharts)[\\/]/,
              priority: 20,
              enforce: true,
            },
            radix: {
              name: 'radix-ui',
              test: /[\\/]node_modules[\\/](@radix-ui)[\\/]/,
              priority: 15,
              enforce: true,
            },
            // Shared chunk for common code
            common: {
              name: 'common',
              minChunks: 2,
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      }
    }

    return config
  },

  // Experimental features to improve stability and performance
  experimental: {
    // Optimize package imports - include lucide-react to prevent vendor-chunks errors
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
