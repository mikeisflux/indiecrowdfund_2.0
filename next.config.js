/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow custom build output directory for zero-downtime deployments
  distDir: process.env.NEXT_BUILD_OUTPUT || '.next',
  // Prevent webpack from bundling these server-only packages (fixes MODULE_NOT_FOUND in production)
  serverExternalPackages: ['jsdom', '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  // Note: Shopify iframe headers are handled by middleware.ts for proper CSP frame-ancestors support
  // Increase body size limit for server actions (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
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
