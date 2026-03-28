const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow custom build output directory for zero-downtime deployments
  distDir: process.env.NEXT_BUILD_OUTPUT || '.next',
  // Note: Shopify iframe headers are handled by middleware.ts for proper CSP frame-ancestors support
  // Externalize jsdom and isomorphic-dompurify so they're resolved from
  // node_modules at runtime. Without this, jsdom's __dirname resolves to
  // the .next build directory causing ENOENT on default-stylesheet.css
  serverExternalPackages: ['jsdom', 'isomorphic-dompurify'],
  experimental: {
    // Increase body size limit for server actions (default is 1MB)
    serverActions: {
      bodySizeLimit: '2gb',
    },
    // Increase body size limit for requests going through middleware (default is 10MB)
    // Without this, large file uploads (PDFs) get truncated and fail with
    // "Failed to parse body as FormData" because the multipart boundary is lost
    middlewareClientMaxBodySize: 2 * 1024 * 1024 * 1024, // 2GB
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
