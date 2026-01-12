import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const serverUrl = process.env.NEXT_PUBLIC_API_URL || "";

    return [
      {
        source: "/api/:path*",
        destination: `${serverUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
