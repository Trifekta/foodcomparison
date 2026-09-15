import openNextWorker from "../.open-next/worker.js";

/**
 * The Worker entry point, wrapping the one OpenNext generates.
 *
 * It exists for one reason: Cloudflare's Cron Triggers call a `scheduled`
 * export, and the generated worker has only `fetch`. That file is rebuilt from
 * scratch on every deploy, so it cannot be edited - the wrapper goes around it
 * instead, and everything it exports is passed straight through.
 *
 * The alternative was a third-party scheduler calling the public URL every few
 * minutes. This is better on every axis that matters here: nothing outside
 * Cloudflare has to know the URL exists, there is no account anywhere else to
 * keep alive, and the schedule lives in the same config as the Worker it drives.
 */

// The Durable Object classes the generated worker exports. Cloudflare resolves
// class bindings by name against this module, so a missing re-export is a
// deploy that fails or a queue that silently has nowhere to run.
export * from "../.open-next/worker.js";

/**
 * Where the schedule points.
 *
 * The existing route rather than the chase function directly: it already
 * handles authorisation, logging and the "nothing was waiting" case, and two
 * callers going through one door is one behaviour to reason about rather than
 * two that drift. The request never leaves the isolate - this calls the same
 * handler the network would reach, without the network.
 */
const CHASE_PATH = "/api/cron/chase-submissions";

interface CronEnv {
  CRON_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

/**
 * Declared here rather than pulled from @cloudflare/workers-types.
 *
 * This file is excluded from the app's typecheck - it imports a module that
 * does not exist until the build has run, and it is compiled for a runtime with
 * different globals than the rest of the codebase. Two fields is a smaller
 * price than a second tsconfig and a dependency for them.
 */
interface ScheduledEvent {
  cron: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

const worker = {
  ...openNextWorker,

  async scheduled(event: ScheduledEvent, env: CronEnv, ctx: WorkerContext) {
    // The route refuses every caller without the secret, internal ones
    // included. Deliberate: one rule about who may run the chaser is easier to
    // be sure of than one rule with an exception, and the exception is the
    // thing nobody re-reads. Said out loud rather than failing quietly, because
    // a chaser that never runs looks exactly like a week when nothing was late.
    if (!env.CRON_SECRET) {
      console.warn("[cron] CRON_SECRET is not set on this Worker, so the chaser cannot run", {
        cron: event.cron,
      });
      return;
    }

    // Any absolute URL works - the request is handed to the handler directly
    // rather than sent anywhere - but the real origin keeps logs readable.
    const base = env.NEXT_PUBLIC_APP_URL?.trim() || "https://snipsavor.trifekta.io";

    const request = new Request(new URL(CHASE_PATH, base), {
      method: "POST",
      headers: { "x-cron-secret": env.CRON_SECRET },
    });

    // waitUntil, so the isolate is kept alive until the chase finishes rather
    // than being torn down when this function returns.
    ctx.waitUntil(
      (async () => {
        try {
          const response = await openNextWorker.fetch(request, env, ctx);
          console.info("[cron] chase run", { cron: event.cron, status: response.status });
        } catch (error) {
          console.error("[cron] chase failed", {
            cron: event.cron,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      })(),
    );
  },
};

export default worker;
