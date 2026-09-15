import "server-only";

/**
 * Which settings the running Worker can actually see.
 *
 * There are two entirely separate places to put a variable on Cloudflare and
 * they are both called "Variables and secrets":
 *
 *  - Build variables, read by `next build`. NEXT_PUBLIC_ values are baked into
 *    the bundle here and are fixed for the life of that deployment.
 *  - The Worker's own variables and secrets, read at request time. Everything
 *    else - the push keys, the cron secret, the service role key - is looked up
 *    here, on every request.
 *
 * Put a runtime secret in the build panel and nothing complains: the build
 * succeeds, the deploy succeeds, the site works, and the one feature that
 * needed it is silently switched off. That is a long afternoon to spend on a
 * dropdown, and it is unnecessary, because the answer is one boolean per name.
 *
 * Presence only. No value is read, logged or returned - the point is to say
 * "the Worker cannot see this", and nothing about that needs the secret itself.
 */

export interface EnvCheck {
  name: string;
  /** Where it has to be set for this to be true. */
  when: "build" | "runtime";
  present: boolean;
  /** False for the ones the app works without. */
  required: boolean;
  /** What stops working, in the admin's terms. */
  what: string;
}

/**
 * Written out one by one on purpose.
 *
 * Next replaces `process.env.NEXT_PUBLIC_THING` with its value at build time by
 * matching that exact text. A lookup built from a variable - process.env[name] -
 * is not matched, so it would read undefined for every NEXT_PUBLIC_ name and
 * report a correctly configured build as broken.
 */
export function checkEnvironment(): EnvCheck[] {
  const has = (value: string | undefined) => Boolean(value?.trim());

  return [
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      when: "build",
      present: has(process.env.NEXT_PUBLIC_SUPABASE_URL),
      required: true,
      what: "everything",
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      when: "build",
      present: has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      required: true,
      what: "everything",
    },
    {
      name: "NEXT_PUBLIC_APP_URL",
      when: "build",
      present: has(process.env.NEXT_PUBLIC_APP_URL),
      required: false,
      what: "links in alerts and messages",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      when: "runtime",
      present: has(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: true,
      what: "taking orders at all",
    },
    {
      name: "WEB_PUSH_PUBLIC_KEY",
      when: "runtime",
      present: has(process.env.WEB_PUSH_PUBLIC_KEY),
      required: false,
      what: "browser notifications",
    },
    {
      name: "WEB_PUSH_PRIVATE_KEY",
      when: "runtime",
      present: has(process.env.WEB_PUSH_PRIVATE_KEY),
      required: false,
      what: "browser notifications",
    },
    {
      name: "CRON_SECRET",
      when: "runtime",
      present: has(process.env.CRON_SECRET),
      required: false,
      what: "chasing orders nobody opened - the 5-minute Cron Trigger does nothing without it",
    },
    {
      name: "TELEGRAM_BOT_TOKEN",
      when: "runtime",
      present: has(process.env.TELEGRAM_BOT_TOKEN),
      required: false,
      what: "Telegram alerts",
    },
    {
      name: "ANTHROPIC_API_KEY",
      when: "runtime",
      present: has(process.env.ANTHROPIC_API_KEY),
      required: false,
      what: "reading a screenshot from the dashboard",
    },
    {
      name: "KEETA_ALLOWED_HOSTS",
      when: "runtime",
      present: has(process.env.KEETA_ALLOWED_HOSTS),
      required: false,
      what: "nothing - the built-in Keeta hosts are used when this is unset",
    },
  ];
}

/**
 * The sentence worth reading first.
 *
 * Specifically about the mistake this panel exists to catch: a runtime value
 * that was put in the build panel is invisible here and looks identical to one
 * that was never set at all.
 */
export function environmentNextStep(checks: EnvCheck[]): string | null {
  const missingRuntime = checks.filter(
    (check) => check.when === "runtime" && check.required && !check.present,
  );
  if (missingRuntime.length > 0) {
    return `${missingRuntime.map((check) => check.name).join(", ")} cannot be read at request time. These belong in the Worker's own Variables and Secrets, not in Build variables - the two panels have the same name and only one of them is read while the site is running.`;
  }

  const missingBuild = checks.filter(
    (check) => check.when === "build" && check.required && !check.present,
  );
  if (missingBuild.length > 0) {
    return `${missingBuild.map((check) => check.name).join(", ")} was not present when this version was built. These are baked in by the build, so setting them now needs a redeploy before anything changes.`;
  }

  return null;
}
