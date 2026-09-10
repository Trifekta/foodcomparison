import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/** Flat config for ESLint 9 + eslint-config-next 16. */
const eslintConfig = [
  ...coreWebVitals,
  ...typescriptConfig,
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "node_modules/**",
      // Vendored OCR engine, copied from node_modules at build time.
      "public/tesseract/**",
      "next-env.d.ts",
      "cloudflare-env.d.ts",
    ],
  },
  {
    // The manual comparison provider implements a future interface; its unused
    // parameters are part of that contract, so underscore-prefixed names are ok.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
