/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Images are served through our own /api/img proxy (handles http→https,
  // hotlink-referer stripping, and edge caching), so next/image remote config
  // is intentionally not used.
  async headers() {
    return [
      {
        source: "/api/img",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
