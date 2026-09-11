"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff, CheckCircle2 } from "lucide-react";
import { sendTestAlert } from "@/lib/admin/actions";

/**
 * Whether anybody will be told when an order arrives.
 *
 * On the dashboard rather than buried in a settings page, because this is the
 * single point of failure in the whole operation: every comparison is done by
 * hand, and an alert that quietly stopped working looks exactly like a quiet
 * day. One tap answers it.
 */
export function AlertStatus({ channels }: { channels: string[] }) {
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const configured = channels.length > 0;

  return (
    <section
      className={`rounded-2xl border p-4 ${
        configured ? "border-ink-200 bg-white" : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="flex items-center gap-2 text-sm text-ink-700">
          {configured ? (
            <Bell aria-hidden="true" className="h-4 w-4 text-ink-500" />
          ) : (
            <BellOff aria-hidden="true" className="h-4 w-4 text-amber-700" />
          )}
          {configured ? (
            <span>
              New orders alert{" "}
              <span className="font-semibold text-ink-900">{channels.join(" and ")}</span>.
            </span>
          ) : (
            <span className="font-semibold text-amber-900">
              Nothing will tell you when an order arrives.
            </span>
          )}
        </p>

        <a
          href="/admin/diagnostics"
          className="min-h-9 shrink-0 self-center text-sm font-semibold text-ink-600 underline underline-offset-2 hover:text-ink-900"
        >
          Diagnostics
        </a>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await sendTestAlert();
              setFeedback({ ok: result.ok, message: result.message ?? "Done." });
            })
          }
          className="min-h-9 shrink-0 rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send a test"}
        </button>
      </div>

      {feedback ? (
        <p
          role="status"
          className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-sm font-medium ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{feedback.message}</span>
        </p>
      ) : null}
    </section>
  );
}
