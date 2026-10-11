import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server in the same checkout (another Claude chat's preview)
  // must not share `.next` with the first: two webpack instances writing one
  // build directory wedge each other. NEXT_DIST_DIR gives it its own.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Use webpack instead of turbopack
  experimental: {
    // turbo: false // This option doesn't exist in NextConfig
  },
  
  // Exclude generated files from webpack watching
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Exclude generated files from file watching
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.next-*/**',
          '**/src/lib/icon-mappings.ts',
          '**/scripts/**'
        ]
      }
    }
    return config
  },
  
  // Optimize development performance
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  }
};

export default nextConfig;
