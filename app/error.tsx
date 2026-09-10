"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary. It shows a plain message and never renders the
 * underlying error text, which could contain configuration details.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Digest only: no customer data, no stack, in the server log.
    console.error("Unhandled application error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="text-2xl font-extrabold text-ink-900">Something went wrong</h1>
      <p className="mt-2 text-base text-ink-600">
        Your information hasn&apos;t been lost. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-13 items-center justify-center rounded-xl border border-brand-500/40 bg-brand-400 px-6 text-base font-semibold text-ink-900"
      >
        Try again
      </button>
    </div>
  );
}
