/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase body size limit for server actions (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Allow local images from /uploads directory
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'indiecrowdfund.com',
        pathname: '/uploads/**',
      },
    ],
  },
};

module.exports = nextConfig;
