/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow custom build output directory for zero-downtime deployments
  distDir: process.env.NEXT_BUILD_OUTPUT || '.next',
  // Note: Shopify iframe headers are handled by middleware.ts for proper CSP frame-ancestors support
  // Externalize jsdom so it's resolved from node_modules at runtime
  // instead of being bundled by webpack (isomorphic-dompurify depends on it for SSR)
  serverExternalPackages: ['jsdom'],
  experimental: {
    // Increase body size limit for server actions (default is 1MB)
    serverActions: {
      bodySizeLimit: '100mb',
    },
    // Increase body size limit for requests going through middleware (default is 10MB)
    // Without this, large file uploads (PDFs) get truncated and fail with
    // "Failed to parse body as FormData" because the multipart boundary is lost
    middlewareClientMaxBodySize: 100 * 1024 * 1024, // 100MB
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

module.exports = nextConfig;
