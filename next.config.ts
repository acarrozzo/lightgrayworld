import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
