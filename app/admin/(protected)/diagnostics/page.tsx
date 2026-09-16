import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { runDiagnostics } from "@/lib/admin/schema-check";
import { getPushStatus, pushNextStep } from "@/lib/push/status";
import { checkEnvironment, environmentNextStep } from "@/lib/admin/env-check";
import { alertChannels } from "@/lib/notifications/admin-alert";
import { isExtractionConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Diagnostics",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * What the database says when the admin's buttons fail.
 *
 * Next redacts server errors in production, so a failing action shows
 * "Something went wrong" and the real message only exists in the logs. This
 * page asks the database the same questions those actions ask and prints the
 * answers verbatim - one screen that turns a mystery into a sentence.
 */
export default async function DiagnosticsPage() {
  const checks = await runDiagnostics();
  const channels = alertChannels();
  const failures = checks.filter((check) => !check.ok);

  const push = await getPushStatus();
  const pushStep = pushNextStep(push);

  const env = checkEnvironment();
  const envStep = environmentNextStep(env);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <h1 className="text-xl font-bold text-ink-900">Diagnostics</h1>
      </div>

      <p className="text-sm text-ink-600">
        {failures.length === 0
          ? "Every query the admin pages rely on came back clean."
          : `${failures.length} of these failed. The message beside each one is the database's own.`}
      </p>

      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <h2 className="border-b border-ink-100 px-5 py-3 text-base font-semibold text-ink-900">
          Database
        </h2>
        <ul className="divide-y divide-ink-100">
          {checks.map((check) => (
            <li key={check.name} className="flex items-start gap-3 px-5 py-3">
              {check.ok ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">{check.name}</p>
                <p
                  className={`mt-0.5 break-words text-sm ${
                    check.ok ? "text-ink-500" : "font-medium text-rose-700"
                  }`}
                >
                  {check.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <h2 className="border-b border-ink-100 px-5 py-3 text-base font-semibold text-ink-900">
          Configuration
        </h2>
        <dl className="divide-y divide-ink-100">
          {[
            ["New order alerts", channels.length > 0 ? channels.join(" and ") : "none configured"],
            ["Screenshot extraction", isExtractionConfigured() ? "configured" : "not configured"],
            ["Site address (links in alerts)", push.appUrl ?? "not set — alerts go out without a link"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <dt className="text-sm text-ink-600">{label}</dt>
              <dd className="text-sm font-medium text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Cloudflare has two panels called "Variables and secrets" and only one
          of them is read while the site is running. Putting a runtime secret in
          the build panel fails silently in every direction: the build passes,
          the deploy passes, the site works, and one feature is quietly off.
          This is one boolean per name, which is all that question ever needed. */}
      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <h2 className="border-b border-ink-100 px-5 py-3 text-base font-semibold text-ink-900">
          What this Worker can see
        </h2>
        <ul className="divide-y divide-ink-100">
          {env.map((check) => (
            <li key={check.name} className="flex items-start gap-3 px-5 py-2.5">
              {check.present ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle
                  aria-hidden="true"
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    check.required ? "text-rose-600" : "text-ink-300"
                  }`}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm text-ink-900">{check.name}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {check.when === "build" ? "Build variable" : "Worker variable or secret"} —{" "}
                  {check.what}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-medium ${
                  check.present ? "text-ink-600" : check.required ? "text-rose-700" : "text-ink-400"
                }`}
              >
                {check.present ? "visible" : "not visible"}
              </span>
            </li>
          ))}
        </ul>

        <p className="border-t border-ink-100 px-5 py-3 text-sm leading-relaxed text-ink-600">
          {envStep ? (
            <>
              <span className="font-semibold text-ink-900">Next: </span>
              {envStep}
            </>
          ) : (
            "Values are never read here, only whether this Worker can see the name. A build variable is baked in when the site is built, so changing one needs a redeploy; a Worker variable is read on every request."
          )}
        </p>
      </section>

      {/* Push has four things that must all be true and one symptom when any of
          them is not: nothing happens. Each one gets its own line, and the
          sentence underneath says which to fix first. */}
      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <h2 className="border-b border-ink-100 px-5 py-3 text-base font-semibold text-ink-900">
          Browser notifications
        </h2>
        <dl className="divide-y divide-ink-100">
          {[
            [
              "Subscriptions table",
              push.tableReadable ? "readable" : (push.tableError ?? "could not be read"),
              push.tableReadable,
            ],
            [
              "VAPID keys on the server",
              push.configured ? `set — contact ${push.subject}` : "not set",
              push.configured,
            ],
            [
              "Admin devices registered",
              push.adminDevices === 0
                ? "none — nothing to notify"
                : `${push.adminDevices} device${push.adminDevices === 1 ? "" : "s"}`,
              push.adminDevices > 0,
            ],
            [
              "Customers waiting on a result",
              String(push.customerDevices),
              true,
            ],
            [
              "Chaser for unopened requests",
              push.chaserConfigured
                ? `on — after ${push.chaserAfterMinutes} minutes`
                : "CRON_SECRET not set, so /api/cron/chase-submissions refuses every caller",
              push.chaserConfigured,
            ],
          ].map(([label, value, ok]) => (
            <div
              key={String(label)}
              className="flex items-baseline justify-between gap-4 px-5 py-3"
            >
              <dt className="text-sm text-ink-600">{label}</dt>
              <dd
                className={`text-right text-sm font-medium ${
                  ok ? "text-ink-900" : "text-rose-700"
                }`}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="border-t border-ink-100 px-5 py-3 text-sm text-ink-600">
          {pushStep ? (
            <>
              <span className="font-semibold text-ink-900">Next: </span>
              {pushStep}
            </>
          ) : (
            "Everything push needs is in place. Use “Send a test” on the dashboard to prove it end to end."
          )}
        </p>
      </section>
    </div>
  );
}
