import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Member photos are capped at 5 MB in the form; allow headroom for the
      // multipart envelope so uploads don't trip the default 1 MB body limit.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
