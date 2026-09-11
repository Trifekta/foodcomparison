import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { runDiagnostics } from "@/lib/admin/schema-check";
import { alertChannels } from "@/lib/notifications/admin-alert";
import { isExtractionConfigured } from "@/lib/env";
import { isEmailConfigured } from "@/lib/notifications/resend";

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
            ["Email sending", isEmailConfigured() ? "configured" : "not configured"],
            ["Screenshot extraction", isExtractionConfigured() ? "configured" : "not configured"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <dt className="text-sm text-ink-600">{label}</dt>
              <dd className="text-sm font-medium text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
