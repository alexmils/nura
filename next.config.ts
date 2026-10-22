import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/changelog": ["./CHANGELOG.md"],
    "/sitemap.xml": ["./CHANGELOG.md"],
  },
  reactStrictMode: true,
  devIndicators: false,
  // Docker/Coolify builds are memory-tight; lint + typecheck run in CI / locally.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async redirects() {
    return [
      {
        source: "/resources",
        destination: "/learn",
        permanent: true,
      },
      {
        source: "/therapy",
        destination: "/learn",
        permanent: true,
      },
      {
        source: "/therapy/:path*",
        destination: "/learn",
        permanent: true,
      },
      {
        source: "/therapists",
        destination: "/learn",
        permanent: true,
      },
      {
        source: "/therapists/:path*",
        destination: "/learn",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
      // Uploaded covers come back as res.cloudinary.com/<cloud>/image/upload/…
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },
  // Non-empty turbopack block silences the warning (empty `{}` is ignored by Next's check).
  // webpack() below only applies to `npm run dev:webpack` (poll/cache for Windows).
  turbopack: {
    root: process.cwd(),
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 500,
      };
    }
    return config;
  },
};

export default nextConfig;
