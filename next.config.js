/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase API body size limit for large payloads (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Also need to configure for API routes
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
