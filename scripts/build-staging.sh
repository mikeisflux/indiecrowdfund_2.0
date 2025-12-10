#!/bin/bash

# Build to staging directory without affecting the live site
# Usage: ./scripts/build-staging.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🔨 Building to staging directory..."

# Backup the original config
cp next.config.js next.config.js.bak

# Create staging config with different distDir
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: '.next-staging',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
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
EOF

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Build using the staging config
echo "🏗️  Running Next.js build..."
BUILD_SUCCESS=false
if npx next build; then
  BUILD_SUCCESS=true
fi

# Restore original config
mv next.config.js.bak next.config.js

if [ "$BUILD_SUCCESS" = true ]; then
  echo ""
  echo "✅ Build successful! Staged in .next-staging"
  echo ""
  echo "To deploy, run: npm run deploy"
  echo "Or manually: ./scripts/deploy.sh"
  exit 0
else
  echo ""
  echo "❌ Build failed! Original config restored."
  exit 1
fi
