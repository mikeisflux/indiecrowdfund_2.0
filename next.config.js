/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase body size limit for server actions (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
