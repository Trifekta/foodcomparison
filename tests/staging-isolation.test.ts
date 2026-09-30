import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  checkEnvironmentsConfig,
  checkStagingValues,
  originOf,
  supabaseRefFromKey,
  supabaseRefFromUrl,
} from "@/lib/deploy/staging-isolation.mjs";

/**
 * Staging must never reach production.
 *
 * What is pinned: every value a staging build or Worker is given is compared
 * against both sides of deploy/environments.json - it must be staging's and
 * must not be production's - and a half-filled config refuses everything
 * rather than protecting nothing. Production (no SNIPSAVOR_ENV) is untouched.
 */

const PROD_REF = "prodprojectref0001";
const STAGING_REF = "stagingprojectref01";

const CONFIG = {
  production: {
    workerName: "foodcomparison",
    supabaseProjectRef: PROD_REF,
    appOrigin: "https://snipsavor.example",
  },
  staging: {
    workerName: "foodcomparison-staging",
    supabaseProjectRef: STAGING_REF,
    appOrigin: "https://foodcomparison-staging.team.workers.dev",
  },
};

/** A legacy Supabase key: a JWT whose payload names the project. Unsigned is fine here. */
function jwtFor(ref: string, role = "anon"): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ iss: "supabase", ref, role })}.signature`;
}

const GOOD = {
  supabaseUrl: `https://${STAGING_REF}.supabase.co`,
  supabaseAnonKey: jwtFor(STAGING_REF),
  appUrl: "https://foodcomparison-staging.team.workers.dev",
  serviceRoleKey: jwtFor(STAGING_REF, "service_role"),
};

describe("parsing", () => {
  it("reads the project ref from the standard Supabase host only", () => {
    expect(supabaseRefFromUrl(`https://${STAGING_REF}.supabase.co`)).toBe(STAGING_REF);
    expect(supabaseRefFromUrl(`https://${STAGING_REF}.supabase.co/`)).toBe(STAGING_REF);
    expect(supabaseRefFromUrl(`http://${STAGING_REF}.supabase.co`)).toBeNull();
    expect(supabaseRefFromUrl("https://db.example.com")).toBeNull();
    expect(supabaseRefFromUrl(`https://${STAGING_REF}.supabase.co.evil.test`)).toBeNull();
    expect(supabaseRefFromUrl("")).toBeNull();
  });

  it("reads the ref claim from a legacy JWT key, and nothing from a new-style key", () => {
    expect(supabaseRefFromKey(jwtFor(PROD_REF, "service_role"))).toBe(PROD_REF);
    expect(supabaseRefFromKey("sb_secret_abc123")).toBeNull();
    expect(supabaseRefFromKey("not.a.jwt")).toBeNull();
    expect(supabaseRefFromKey(undefined)).toBeNull();
  });

  it("accepts only https origins", () => {
    expect(originOf("https://a.example/path?x=1")).toBe("https://a.example");
    expect(originOf("http://a.example")).toBeNull();
    expect(originOf("nonsense")).toBeNull();
  });
});

describe("checkEnvironmentsConfig", () => {
  it("accepts a complete config", () => {
    expect(checkEnvironmentsConfig(CONFIG)).toEqual([]);
  });

  it("refuses blanks on either side", () => {
    const blank = {
      production: { ...CONFIG.production, supabaseProjectRef: "", appOrigin: "" },
      staging: CONFIG.staging,
    };
    expect(checkEnvironmentsConfig(blank)).toHaveLength(2);
  });

  it("refuses staging and production naming the same project or site", () => {
    const same = {
      production: CONFIG.production,
      staging: { ...CONFIG.staging, supabaseProjectRef: PROD_REF, appOrigin: CONFIG.production.appOrigin },
    };
    const problems = checkEnvironmentsConfig(same);
    expect(problems.join(" ")).toMatch(/same Supabase project/);
    expect(problems.join(" ")).toMatch(/same app origin/);
  });

  it("refuses an origin with a path", () => {
    const withPath = { ...CONFIG, staging: { ...CONFIG.staging, appOrigin: "https://x.example/app" } };
    expect(checkEnvironmentsConfig(withPath)).toHaveLength(1);
  });

  it("refuses the committed config until somebody fills it in", async () => {
    const committed = (await import("@/deploy/environments.json")).default;
    expect(checkEnvironmentsConfig(committed).length).toBeGreaterThan(0);
  });
});

describe("checkStagingValues", () => {
  it("passes a fully staging set of values", () => {
    expect(checkStagingValues(GOOD, CONFIG)).toEqual([]);
  });

  it("passes new-style keys, which carry no project to compare", () => {
    expect(
      checkStagingValues(
        { ...GOOD, supabaseAnonKey: "sb_publishable_x", serviceRoleKey: "sb_secret_y" },
        CONFIG,
      ),
    ).toEqual([]);
  });

  it.each([
    ["the production Supabase URL", { supabaseUrl: `https://${PROD_REF}.supabase.co` }, /PRODUCTION Supabase project/],
    ["an unknown Supabase project", { supabaseUrl: "https://someotherproject1.supabase.co" }, /not the staging project/],
    ["no Supabase URL", { supabaseUrl: "" }, /must be set/],
    ["a production anon key", { supabaseAnonKey: jwtFor(PROD_REF) }, /ANON_KEY is a PRODUCTION/],
    ["a production service-role key", { serviceRoleKey: jwtFor(PROD_REF, "service_role") }, /SERVICE_ROLE_KEY is a PRODUCTION/],
    ["the production app URL", { appUrl: "https://snipsavor.example" }, /PRODUCTION site/],
    ["some other app URL", { appUrl: "https://elsewhere.example" }, /not https:\/\/foodcomparison-staging/],
    ["no app URL", { appUrl: "" }, /NEXT_PUBLIC_APP_URL must be set/],
    ["no anon key", { supabaseAnonKey: "" }, /ANON_KEY must be set/],
  ])("refuses %s", (_label, override, message) => {
    const problems = checkStagingValues({ ...GOOD, ...override }, CONFIG);
    expect(problems.join(" ")).toMatch(message);
  });

  it("refuses everything while the config is incomplete", () => {
    const incomplete = { ...CONFIG, production: { ...CONFIG.production, supabaseProjectRef: "" } };
    expect(checkStagingValues(GOOD, incomplete).join(" ")).toMatch(/production.supabaseProjectRef/);
  });
});

describe("runtime guard in lib/env.ts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("@/deploy/environments.json");
  });

  async function loadEnv(values: Record<string, string>) {
    for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
    vi.resetModules();
    vi.doMock("@/deploy/environments.json", () => ({ default: CONFIG }));
    return import("@/lib/env");
  }

  const stagingEnv = {
    SNIPSAVOR_ENV: "staging",
    NEXT_PUBLIC_SUPABASE_URL: GOOD.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: GOOD.supabaseAnonKey,
    NEXT_PUBLIC_APP_URL: GOOD.appUrl,
    SUPABASE_SERVICE_ROLE_KEY: GOOD.serviceRoleKey,
  };

  it("does nothing on production, whatever the values", async () => {
    const env = await loadEnv({
      ...stagingEnv,
      SNIPSAVOR_ENV: "",
      NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_REF}.supabase.co`,
      NEXT_PUBLIC_APP_URL: "https://snipsavor.example",
    });
    expect(env.isStagingDeployment()).toBe(false);
    expect(env.getSupabaseUrl()).toBe(`https://${PROD_REF}.supabase.co`);
  });

  it("lets a correctly configured staging Worker through", async () => {
    const env = await loadEnv(stagingEnv);
    expect(env.getSupabaseUrl()).toBe(GOOD.supabaseUrl);
  });

  it("stops a staging Worker built with production's Supabase URL", async () => {
    const env = await loadEnv({ ...stagingEnv, NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_REF}.supabase.co` });
    expect(() => env.getSupabaseUrl()).toThrow(/Staging isolation check failed/);
  });

  it("stops a staging Worker holding production's service-role key", async () => {
    const env = await loadEnv({ ...stagingEnv, SUPABASE_SERVICE_ROLE_KEY: jwtFor(PROD_REF, "service_role") });
    expect(() => env.getSupabaseUrl()).toThrow(/PRODUCTION Supabase key/);
  });

  it("stops a staging Worker built with production's app URL", async () => {
    const env = await loadEnv({ ...stagingEnv, NEXT_PUBLIC_APP_URL: "https://snipsavor.example" });
    expect(() => env.getSupabaseUrl()).toThrow(/PRODUCTION site/);
  });
});

describe("wrangler.jsonc", () => {
  it("keeps production at the top level and staging on its own Worker", async () => {
    const { unstable_readConfig } = await import("wrangler");
    const configPath = path.resolve(import.meta.dirname, "../wrangler.jsonc");

    const production = unstable_readConfig({ config: configPath });
    expect(production.name).toBe("foodcomparison");
    expect(production.vars).not.toHaveProperty("SNIPSAVOR_ENV");

    const staging = unstable_readConfig({ config: configPath, env: "staging" });
    expect(staging.name).toBe("foodcomparison-staging");
    expect(staging.vars).toEqual({ SNIPSAVOR_ENV: "staging" });
    expect(staging.main).toBe(production.main);
    expect(staging.compatibility_flags).toEqual(production.compatibility_flags);
    expect(staging.assets?.directory).toBe(production.assets?.directory);
    expect(staging.triggers).toEqual(production.triggers);
  }, 30_000);
});

describe("scripts/build-staging.mjs", () => {
  it("refuses to build while deploy/environments.json is blank, even with plausible values", () => {
    const result = spawnSync(process.execPath, ["scripts/build-staging.mjs", "--check-only"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: GOOD.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: GOOD.supabaseAnonKey,
        NEXT_PUBLIC_APP_URL: GOOD.appUrl,
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Refusing to build for STAGING/);
    expect(result.stderr).toMatch(/deploy\/environments.json/);
  });
});
