import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Screenshots are uploaded through a server route; allow room for two 10 MB images.
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;

/**
 * Gives `next dev` access to Cloudflare bindings and .dev.vars.
 *
 * Loaded lazily and only in development so a production build - on Cloudflare,
 * Vercel or anywhere else - never depends on the adapter being present.
 */
if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare")
    .then(({ initOpenNextCloudflareForDev }) => initOpenNextCloudflareForDev())
    .catch(() => {
      // The adapter is optional locally; plain `next dev` still works without it.
    });
}
