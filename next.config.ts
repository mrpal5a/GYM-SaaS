import type { NextConfig } from "next";

// Allow Next/Image to serve images from this project's Supabase Storage. Derived
// from the env URL so it works for any tenant/deployment without hardcoding.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Member photos and gym logos are capped at 5 MB in the form; allow headroom
      // for the multipart envelope so uploads don't trip the default 1 MB body limit.
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
