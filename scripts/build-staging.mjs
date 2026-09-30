#!/usr/bin/env node
/**
 * Builds the STAGING Worker bundle - and refuses to if anything points at
 * production.
 *
 *   npm run cf:build:staging          check, then build .open-next/ for staging
 *   npm run check:staging-env         check only; builds nothing
 *
 * Why a wrapper rather than plain `npm run cf:build`:
 *
 *   NEXT_PUBLIC_* values are baked into the bundle by `next build`, on the
 *   server as well as in the browser - a runtime secret cannot change them
 *   afterwards. So the build is the last moment a wrong Supabase URL or app URL
 *   can be caught cheaply. After it, the only defence is the runtime check in
 *   lib/env.ts, which stops the Worker working rather than stopping the deploy.
 *
 * What it enforces, beyond lib/deploy/staging-isolation.mjs:
 *
 *   - No .env / .env.local / .env.production[.local] in the project. Next reads
 *     those during the build and fills any variable the environment left
 *     unset - which on a developer's machine usually means production values.
 *   - The Meta Pixel is switched off. Unset, it defaults to the production ad
 *     pixel (lib/analytics/meta-pixel.ts), and staging visits would be counted
 *     against real adverts.
 *
 * The production build (`npm run cf:build`) is untouched by any of this.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkStagingValues } from "../lib/deploy/staging-isolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check-only");

/** Files Next loads during a production build, in the order it prefers them. */
const FORBIDDEN_ENV_FILES = [".env.production.local", ".env.local", ".env.production", ".env"];

const config = JSON.parse(readFileSync(path.join(root, "deploy/environments.json"), "utf8"));

const problems = [
  ...FORBIDDEN_ENV_FILES.filter((file) => existsSync(path.join(root, file))).map(
    (file) =>
      `${file} exists. Next would read it during this build and could fill in production values. Move it aside for a staging build.`,
  ),
  ...checkStagingValues(
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      // Not needed to build. Checked if present, because a service-role key in
      // the build variables is a sign somebody pasted from the wrong place.
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    config,
  ),
];

if (problems.length > 0) {
  console.error("\n✘ Refusing to build for STAGING:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("\nSee docs/staging/README.md.\n");
  process.exit(1);
}

console.log(
  `✔ Staging isolation checks passed: Supabase ${config.staging.supabaseProjectRef}, app ${config.staging.appOrigin}, Meta Pixel off.`,
);
if (checkOnly) process.exit(0);

const env = {
  ...process.env,
  // Empty, not unset: unset means "use the production pixel".
  NEXT_PUBLIC_META_PIXEL_ID: "",
};

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, ["scripts/copy-ocr-assets.mjs"]);
run(path.join(root, "node_modules/.bin/opennextjs-cloudflare"), ["build", "--env", "staging"]);
