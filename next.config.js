/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@clerk/clerk-sdk-node'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure these Node.js modules are not included in client-side bundles
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        events: false,
        http2: false,
        child_process: false,
      };
    }
    return config;
  },
  typescript: {
    // This allows the build to proceed despite TypeScript errors
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Match all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "Accept, Content-Type" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;