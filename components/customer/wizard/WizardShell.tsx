"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { TOTAL_STEPS } from "./types";

interface WizardShellProps {
  step: number;
  /** Shown instead of "Step n of 4" on the review screen. */
  stepLabel?: string;
  onBack: (() => void) | null;
  children: React.ReactNode;
}

export function WizardShell({ step, stepLabel, onBack, children }: WizardShellProps) {
  const percent = Math.round((Math.min(step, TOTAL_STEPS) / TOTAL_STEPS) * 100);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="sticky top-0 z-10 -mx-5 bg-canvas/95 px-5 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100"
              aria-label="Go back"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </button>
          ) : (
            <Link
              href="/"
              className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100"
              aria-label="Back to home"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
          )}
          <span className="text-xs font-black tracking-[0.25em] text-ink-900">{BRAND_NAME}</span>
          <span className="ml-auto text-xs font-semibold text-ink-500">
            {stepLabel ?? `Step ${step} of ${TOTAL_STEPS}`}
          </span>
        </div>

        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={Math.min(step, TOTAL_STEPS)}
          aria-label="Progress"
        >
          <div className="h-full rounded-full bg-brand-400" style={{ width: `${percent}%` }} />
        </div>
      </header>

      <main className="flex flex-1 flex-col pb-8 pt-6">{children}</main>
    </div>
  );
}
