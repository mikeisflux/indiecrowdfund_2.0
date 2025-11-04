/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'uploadthing.com', 'utfs.io'],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
}

module.exports = nextConfig
