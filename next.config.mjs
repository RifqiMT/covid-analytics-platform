/** @type {import('next').NextConfig} */
const nextConfig = {
  // Leaflet + react-leaflet can throw "Map container is already initialized"
  // under React Strict Mode in dev (intentional double-mount to surface side effects).
  // Disabling Strict Mode avoids the recurring dev-only runtime overlay.
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/next/:path*",
        destination: "/_next/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
