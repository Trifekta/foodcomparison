import { CheckCircle2, Info } from "lucide-react";
import type { SavingResult } from "@/lib/calculations/saving";
import { formatMinorAsCurrency } from "@/lib/calculations/money";

interface PriceVerdictProps {
  sourceAppLabel: string;
  comparisonAppLabel: string;
  currentTotalMinor: number;
  comparisonTotalMinor: number;
  saving: SavingResult;
  /** Facts the admin confirmed while rebuilding the basket. */
  checks?: string[];
}

/**
 * The verdict the customer will be told, shown to the admin exactly as it will
 * read. A pricier alternative is never dressed up as a saving.
 */
export function PriceVerdict({
  sourceAppLabel,
  comparisonAppLabel,
  currentTotalMinor,
  comparisonTotalMinor,
  saving,
  checks = [],
}: PriceVerdictProps) {
  if (!saving.hasSaving) {
    return (
      <div className="rounded-3xl border border-ink-200 bg-ink-50 p-5">
        <p className="flex items-start gap-2 text-[0.95rem] font-bold text-ink-800">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
          No cheaper option found on {comparisonAppLabel}.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-ink-500">{sourceAppLabel}</dt>
            <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-ink-900">
              {formatMinorAsCurrency(currentTotalMinor)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">{comparisonAppLabel}</dt>
            <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-ink-900">
              {formatMinorAsCurrency(comparisonTotalMinor)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-500">
          The customer&apos;s current option is better right now — we tell them so.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-brand-300 bg-white">
      <div className="bg-brand-300 px-5 py-4 text-center">
        <p className="text-sm font-bold text-ink-800">{comparisonAppLabel} offer ready</p>
        <h3 className="mt-0.5 text-xl font-extrabold tracking-tight text-ink-900">
          {comparisonAppLabel} beats the price
        </h3>
      </div>

      <div className="p-5">
        <p className="text-sm text-ink-500">{sourceAppLabel}</p>
        <p className="text-lg font-bold tabular-nums text-ink-400 line-through">
          {formatMinorAsCurrency(currentTotalMinor)}
        </p>

        <p className="mt-3 text-sm font-bold text-ink-900">{comparisonAppLabel}</p>
        <p className="text-[2.5rem] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">
          {formatMinorAsCurrency(comparisonTotalMinor)}
        </p>

        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-base font-extrabold text-ink-900">
          You save{" "}
          <span className="text-emerald-700">
            {formatMinorAsCurrency(saving.savingMinor)}
          </span>
          <span className="ml-2 text-sm font-bold text-emerald-700">
            {saving.savingPercentage.toFixed(1)}%
          </span>
        </p>

        {checks.length > 0 ? (
          <ul className="mt-4 space-y-2.5 rounded-2xl border border-ink-100 p-4">
            {checks.map((check) => (
              <li key={check} className="flex items-center gap-2.5 text-sm font-semibold text-ink-800">
                <CheckCircle2 aria-hidden="true" className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
                {check}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
