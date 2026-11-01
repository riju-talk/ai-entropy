const path = require('path')

// Local development loads the shared root .env if dotenv is installed; hosts inject env vars directly.
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
} catch (e) {
  /* dotenv is optional */
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["placeholder.svg", "lh3.googleusercontent.com", "avatars.githubusercontent.com"],
    unoptimized: true,
  },
  // Reduce build warnings
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  // Experimental features for better build performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
}

module.exports = nextConfig
