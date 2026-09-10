"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/customer/Wordmark";
import { ScreenFooter } from "@/components/customer/Motifs";
import { TOTAL_STEPS } from "./types";

interface WizardShellProps {
  step: number;
  /** Overrides "Step n of 4" where a screen is better named than numbered. */
  stepLabel?: string;
  onBack: (() => void) | null;
  children: React.ReactNode;
}

export function WizardShell({ step, stepLabel, onBack, children }: WizardShellProps) {
  const reached = Math.min(step, TOTAL_STEPS);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="sticky top-0 z-10 -mx-5 bg-canvas/95 px-5 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-900 hover:bg-ink-100"
              aria-label="Go back"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
            </button>
          ) : (
            <Link
              href="/"
              className="-ml-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-900 hover:bg-ink-100"
              aria-label="Back to home"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
            </Link>
          )}
          <Wordmark size="sm" />
          <span className="ml-auto text-sm font-semibold text-slate-500">
            {stepLabel ?? `Step ${step} of ${TOTAL_STEPS}`}
          </span>
        </div>

        {/* One segment per step, as in the designs. */}
        <div
          className="mt-3 flex gap-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={reached}
          aria-label="Progress"
        >
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index < reached ? "bg-brand-400" : "bg-ink-200"
              }`}
            />
          ))}
        </div>
      </header>

      <main className="flex flex-1 flex-col pt-4">{children}</main>

      <ScreenFooter />
    </div>
  );
}
