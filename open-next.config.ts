import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext configuration for Cloudflare Workers.
 *
 * No incremental cache or revalidation queue is configured, because nothing in
 * this app uses ISR: every customer and admin route is force-dynamic, and the
 * static pages (landing, privacy, 404, icon) are served from Workers Assets.
 * Adding caching later means setting a cache adapter here and adding the
 * matching KV/R2 bindings in wrangler.jsonc.
 */
export default defineCloudflareConfig();
