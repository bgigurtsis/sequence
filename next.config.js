/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      }
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_FIREBASE_FUNCTION_URL ? 
          `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTION_URL}/:path*` : '/:path*',
      }
    ];
  }
};

module.exports = nextConfig;