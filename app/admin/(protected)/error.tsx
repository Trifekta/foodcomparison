"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The admin's own error screen.
 *
 * The customer-facing one apologises and offers to try again, which is right
 * for a customer and useless for the person who has to fix it. Next redacts a
 * server error's message in production, so the digest is the only thing that
 * ties this screen to a line in the logs - and the commonest cause by far is a
 * migration that has not been run, which the dashboard can name outright.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <h1 className="text-xl font-bold text-ink-900">Something went wrong here</h1>
      <p className="text-sm text-ink-600">
        Diagnostics runs the same queries these pages rely on and prints what the database says
        back, which is the fastest way to find out what this actually was.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="min-h-10 rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50"
        >
          Try again
        </button>
        <Link
          href="/admin/diagnostics"
          className="inline-flex min-h-10 items-center rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800"
        >
          Open diagnostics
        </Link>
      </div>

      {error.digest ? (
        <p className="text-xs text-ink-500">
          Reference for the logs: <code className="font-semibold">{error.digest}</code>
        </p>
      ) : null}
    </div>
  );
}
