// Load shared root .env for the monorepo (do not expose via nextConfig.env)
const path = require('path')
try {
  // Try to load dotenv if available (won't crash if package missing)
  // This allows starting Next without running npm install immediately.
  // For full env loading, run `npm install` to install dotenv.
  // Note: keep dotenv usage optional
  // If your code relies on .env variables, install dotenv and restart.
  /* eslint-disable global-require */
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
  /* eslint-enable global-require */
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('dotenv not installed — skipping .env load (run `npm install` to install it):', e.message)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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
