const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow custom build output directory for zero-downtime deployments
  distDir: process.env.NEXT_BUILD_OUTPUT || '.next',
  // Don't re-run type-checking inside `next build`. The deploy script
  // (build-and-swap.sh, Step 4) already runs a full, blocking
  // `tsc --noEmit --project tsconfig.build.json` that aborts the deploy on
  // any type error BEFORE `next build` is ever reached — so Next's built-in
  // pass is duplicate work that re-type-checks the whole codebase a second
  // time. Type SAFETY is unchanged — it's still enforced, just once.
  // (ESLint isn't configured here: Next 16 removed the in-build ESLint
  // integration, so it doesn't run during `next build` at all — linting is
  // the separate `lint` script / CI.)
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      // Redirect www to non-www (Google verification and SEO)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.indiecrowdfund.com' }],
        destination: 'https://indiecrowdfund.com/:path*',
        permanent: true,
      },
      { source: '/cookies', destination: '/privacy#cookies', permanent: true },
      // Rename (2026-05-19): /marketplace → /shop, /discover → /crowdfunds.
      // Public-facing URL changes, with 301 redirects to preserve link
      // equity from search indexes, emailed links, and any external
      // bookmarks. /api/marketplace/* paths are NOT renamed — those
      // serve uploaded files (digital downloads, audio streams, video
      // streams) and any URL already shared in a confirmation email
      // would 404 if those moved.
      { source: '/marketplace', destination: '/shop', permanent: true },
      { source: '/marketplace/:path*', destination: '/shop/:path*', permanent: true },
      { source: '/discover', destination: '/crowdfunds', permanent: true },
      { source: '/discover/:path*', destination: '/crowdfunds/:path*', permanent: true },
      { source: '/marketplace-handbook', destination: '/shop-handbook', permanent: true },
      { source: '/marketplace-handbook/:path*', destination: '/shop-handbook/:path*', permanent: true },
      { source: '/dashboard/marketplace', destination: '/dashboard/shop', permanent: true },
      { source: '/dashboard/marketplace/:path*', destination: '/dashboard/shop/:path*', permanent: true },
      { source: '/admin/marketplace', destination: '/admin/shop', permanent: true },
      { source: '/admin/marketplace/:path*', destination: '/admin/shop/:path*', permanent: true },
    ];
  },
  // Note: Shopify iframe headers are handled by proxy.ts for proper CSP frame-ancestors support
  // Externalize jsdom and isomorphic-dompurify so they're resolved from
  // node_modules at runtime. Without this, jsdom's __dirname resolves to
  // the .next build directory causing ENOENT on default-stylesheet.css
  serverExternalPackages: ['jsdom', 'isomorphic-dompurify'],
  experimental: {
    // Turbopack filesystem cache for dev only — the build cache uses
    // too much memory (~19GB) for production builds on this server.
    turbopackFileSystemCacheForDev: true,
    // Increase body size limit for server actions (default is 1MB)
    serverActions: {
      bodySizeLimit: '2gb',
      // Accept Server Action POSTs whose `origin` header is the www.
      // variant even though `x-forwarded-host` is the apex. Next.js 15+
      // rejects the action otherwise with "`x-forwarded-host` header
      // with value `indiecrowdfund.com` does not match `origin` header
      // with value `www.indiecrowdfund.com` from a forwarded Server
      // Actions request. Aborting the action." — seen on the pm2 log.
      // The www -> apex 301 redirect above handles HTML navigation but
      // a client that already has the action-bundle loaded will fire
      // the POST against the origin it was served under.
      allowedOrigins: [
        'indiecrowdfund.com',
        'www.indiecrowdfund.com',
      ],
    },
    // Increase body size limit for requests going through proxy (default is 10MB)
    // Without this, large file uploads (PDFs) get truncated and fail with
    // "Failed to parse body as FormData" because the multipart boundary is lost
    proxyClientMaxBodySize: 2 * 1024 * 1024 * 1024, // 2GB
    // Tree-shake large icon/component libraries for smaller bundles
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'date-fns',
    ],
  },
  // Image optimization settings
  images: {
    // Modern image formats for better compression
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 30 days
    minimumCacheTTL: 2592000,
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'indiecrowdfund.com',
        pathname: '/api/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/api/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = withBundleAnalyzer(nextConfig);
