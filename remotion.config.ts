import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

/**
 * Remotion renders the launch ad from the product's own React components.
 *
 * It is a build-time tool and not part of the app: nothing under app/ imports
 * it, it lives in devDependencies, and `next build` never sees remotion/.
 *
 * Two overrides earn their keep.
 *
 * Tailwind, so the ad draws with the real utility classes and the real tokens
 * in app/globals.css. The alternative is a second copy of the palette living in
 * the video, which is wrong the first morning somebody changes the gold and
 * only the website moves.
 *
 * The "@/" alias, so a scene can import the shipping Wordmark and Motifs by the
 * specifier the rest of the codebase uses. Remotion bundles with its own
 * webpack and does not read Next's module resolution or tsconfig paths.
 *
 * The alias is anchored on process.cwd() and not __dirname: Remotion evaluates
 * this file from inside its own CLI, where __dirname is the CLI's dist folder
 * and every "@/" import silently resolves into node_modules. The CLI is always
 * invoked from the package root, through the ad:* scripts, so the working
 * directory is the repository.
 */

Config.setEntryPoint("./remotion/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

Config.overrideWebpackConfig((currentConfig) => {
  const withTailwind = enableTailwind(currentConfig);

  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...withTailwind.resolve?.alias,
        "@": path.resolve(process.cwd()),
      },
    },
  };
});
