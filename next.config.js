/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow custom build output directory for zero-downtime deployments
  distDir: process.env.NEXT_BUILD_OUTPUT || '.next',
  // Increase body size limit for server actions (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Allow images from API uploads endpoint
  images: {
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
    ],
  },
};

module.exports = nextConfig;
