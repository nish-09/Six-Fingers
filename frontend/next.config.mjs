/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double-mounting WebRTC streams and MediaPipe in dev
  webpack: (config) => {
    // MediaPipe wasm handling
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
  async rewrites() {
    const rawBackend = (
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "https://six-fingers-backend.onrender.com"
    ).trim().replace(/\/+$/, "");

    const backendUrl = rawBackend.endsWith("/api")
      ? rawBackend.slice(0, -4).replace(/\/+$/, "")
      : rawBackend;

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
