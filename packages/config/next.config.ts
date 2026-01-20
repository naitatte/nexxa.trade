import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const serverUrl = process.env.API_SERVER_URL;
    if (!serverUrl) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${serverUrl.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
