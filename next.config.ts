import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/npm-admin",
        destination: "http://nginx-proxy-manager:81/",
      },
      {
        source: "/npm-admin/:path*",
        destination: "http://nginx-proxy-manager:81/:path*",
      },
    ];
  },
};

export default nextConfig;
