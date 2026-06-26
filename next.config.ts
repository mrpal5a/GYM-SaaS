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
  // @react-pdf/renderer pulls in fontkit + a wasm layout engine that don't survive
  // Next's bundler; load it from node_modules at runtime in the Node server runtime.
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      // Uploads are capped at 5 MB each in the forms; the public join form can carry
      // two images (member photo + UPI payment screenshot), so allow headroom over
      // the default 1 MB body limit for the multipart envelope.
      bodySizeLimit: "12mb",
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
