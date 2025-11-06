/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["agentic-116b94c5.vercel.app"],
    },
  },
};

export default nextConfig;
