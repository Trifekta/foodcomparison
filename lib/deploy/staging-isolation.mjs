/**
 * Keeping staging away from production.
 *
 * Staging is a separate Worker (foodcomparison-staging) talking to a separate
 * Supabase project. The danger is never the code - it is one value copied from
 * the wrong dashboard: production's Supabase URL in a staging build variable,
 * production's service-role key in a staging secret, production's
 * NEXT_PUBLIC_APP_URL baked into a staging build. Any one of those and a
 * staging test writes to real customers' data, or hands out links to the live
 * site.
 *
 * So both sides are named in deploy/environments.json - public identifiers
 * only, reviewed in a pull request like any other change - and every staging
 * value must match the staging side AND differ from the production side. Blank
 * entries fail too: a check that does not know what production looks like
 * cannot refuse it.
 *
 * Used in two places with the same rules:
 *   - scripts/build-staging.mjs, before a staging build starts;
 *   - lib/env.ts, on the staging Worker at runtime (SNIPSAVOR_ENV=staging),
 *     for a build that reached staging without going through that script.
 *
 * Plain JavaScript so the build script can run it with node and no compiler.
 * Nothing here reads the environment itself; callers pass values in.
 */

/**
 * @typedef {{ workerName: string, supabaseProjectRef: string, appOrigin: string }} EnvironmentEntry
 * @typedef {{ production: EnvironmentEntry, staging: EnvironmentEntry }} EnvironmentsConfig
 * @typedef {{
 *   supabaseUrl?: string | null,
 *   supabaseAnonKey?: string | null,
 *   appUrl?: string | null,
 *   serviceRoleKey?: string | null,
 * }} StagingValues
 */

const SUPABASE_HOST = /^([a-z0-9]{10,40})\.supabase\.co$/;
const PROJECT_REF = /^[a-z0-9]{10,40}$/;

/**
 * The project ref in https://<ref>.supabase.co, or null.
 *
 * Only the standard host is accepted. A custom Supabase domain would hide the
 * project behind a name this check cannot compare, and staging has no reason to
 * use one.
 *
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function supabaseRefFromUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    return url.hostname.match(SUPABASE_HOST)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * The `ref` claim of a legacy Supabase JWT key (anon or service_role), or null.
 *
 * Newer sb_publishable_/sb_secret_ keys carry no project in them and return
 * null; for those, Supabase itself refuses a key from another project.
 *
 * @param {string | null | undefined} key
 * @returns {string | null}
 */
export function supabaseRefFromKey(key) {
  if (!key) return null;
  const parts = key.trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof payload?.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function originOf(value) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Whether deploy/environments.json is filled in well enough to protect anything.
 *
 * @param {EnvironmentsConfig} config
 * @returns {string[]} problems, empty when usable
 */
export function checkEnvironmentsConfig(config) {
  const problems = [];
  const { production, staging } = config;

  for (const [label, entry] of /** @type {const} */ ([
    ["production", production],
    ["staging", staging],
  ])) {
    if (!PROJECT_REF.test(entry?.supabaseProjectRef ?? "")) {
      problems.push(
        `deploy/environments.json: ${label}.supabaseProjectRef is missing or malformed (the <ref> in https://<ref>.supabase.co).`,
      );
    }
    if (!originOf(entry?.appOrigin) || originOf(entry.appOrigin) !== entry.appOrigin) {
      problems.push(
        `deploy/environments.json: ${label}.appOrigin must be an https origin with no path, e.g. https://example.com.`,
      );
    }
  }

  if (problems.length > 0) return problems;

  if (staging.supabaseProjectRef === production.supabaseProjectRef) {
    problems.push("deploy/environments.json: staging and production name the same Supabase project.");
  }
  if (staging.appOrigin === production.appOrigin) {
    problems.push("deploy/environments.json: staging and production name the same app origin.");
  }
  if (staging.workerName === production.workerName) {
    problems.push("deploy/environments.json: staging and production name the same Worker.");
  }
  return problems;
}

/**
 * Every problem with running these values as staging. Empty means isolated.
 *
 * Values that are absent are only a problem where staging cannot work without
 * them (the Supabase URL and key, the app URL). The service-role key is checked
 * when it is present, because a build does not need it and a Worker does.
 *
 * @param {StagingValues} values
 * @param {EnvironmentsConfig} config
 * @returns {string[]}
 */
export function checkStagingValues(values, config) {
  const configProblems = checkEnvironmentsConfig(config);
  if (configProblems.length > 0) return configProblems;

  const problems = [];
  const staging = config.staging;
  const production = config.production;

  const urlRef = supabaseRefFromUrl(values.supabaseUrl);
  if (!urlRef) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL must be set to https://<staging-ref>.supabase.co.");
  } else if (urlRef === production.supabaseProjectRef) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL is the PRODUCTION Supabase project.");
  } else if (urlRef !== staging.supabaseProjectRef) {
    problems.push(
      `NEXT_PUBLIC_SUPABASE_URL is project ${urlRef}, not the staging project named in deploy/environments.json.`,
    );
  }

  if (!values.supabaseAnonKey?.trim()) {
    problems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to the staging project's anon/publishable key.");
  }

  for (const [name, key] of /** @type {const} */ ([
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", values.supabaseAnonKey],
    ["SUPABASE_SERVICE_ROLE_KEY", values.serviceRoleKey],
  ])) {
    const keyRef = supabaseRefFromKey(key);
    if (keyRef === null) continue;
    if (keyRef === production.supabaseProjectRef) {
      problems.push(`${name} is a PRODUCTION Supabase key.`);
    } else if (keyRef !== staging.supabaseProjectRef) {
      problems.push(`${name} belongs to project ${keyRef}, not the staging project.`);
    }
  }

  const appOrigin = originOf(values.appUrl);
  if (!appOrigin) {
    problems.push(`NEXT_PUBLIC_APP_URL must be set to ${staging.appOrigin}.`);
  } else if (appOrigin === production.appOrigin) {
    problems.push("NEXT_PUBLIC_APP_URL is the PRODUCTION site.");
  } else if (appOrigin !== staging.appOrigin) {
    problems.push(`NEXT_PUBLIC_APP_URL is ${appOrigin}, not ${staging.appOrigin}.`);
  }

  return problems;
}
