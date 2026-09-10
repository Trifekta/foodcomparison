"use client";

import { useMemo, useState, useTransition } from "react";
import { Calculator, CheckCircle2, Info } from "lucide-react";
import { saveComparison } from "@/lib/admin/actions";
import { Button } from "@/components/ui/Button";
import { AmountInput } from "@/components/forms/AmountInput";
import { calculateSaving } from "@/lib/calculations/saving";
import {
  MoneyParseError,
  formatMinorAsCurrency,
  parseAmountToMinor,
} from "@/lib/calculations/money";
import { comparisonTotalSchema } from "@/lib/validation/admin";

interface ComparisonPanelProps {
  submissionId: string;
  comparisonApp: string;
  sourceAppLabel: string;
  currentTotal: string;
  initial: {
    comparisonTotal: string;
    restaurantFound: string;
    comparisonLocationNote: string;
    adminNotes: string;
  };
}

/**
 * The comparison workspace.
 *
 * The saving is previewed live as the admin types, but nothing is written until
 * they save deliberately. Both the preview and the persisted value come from
 * calculateSaving() - the maths exists in exactly one place.
 */
export function ComparisonPanel({
  submissionId,
  comparisonApp,
  sourceAppLabel,
  currentTotal,
  initial,
}: ComparisonPanelProps) {
  const [comparisonTotal, setComparisonTotal] = useState(initial.comparisonTotal);
  const [restaurantFound, setRestaurantFound] = useState(initial.restaurantFound);
  const [locationNote, setLocationNote] = useState(initial.comparisonLocationNote);
  const [notes, setNotes] = useState(initial.adminNotes);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const currentMinor = useMemo(() => parseAmountToMinor(currentTotal) ?? 0, [currentTotal]);

  const preview = useMemo(() => {
    try {
      const minor = parseAmountToMinor(comparisonTotal);
      if (minor === null) return null;
      return { minor, saving: calculateSaving(currentMinor, minor) };
    } catch (error) {
      if (error instanceof MoneyParseError) return null;
      throw error;
    }
  }, [comparisonTotal, currentMinor]);

  const validation = comparisonTotalSchema.safeParse(comparisonTotal);
  const inputError =
    comparisonTotal.trim() === "" ? undefined : validation.success ? undefined : validation.error.issues[0]?.message;

  const onSave = () => {
    if (!validation.success) {
      setFeedback({ ok: false, message: validation.error.issues[0]?.message ?? "Check the total." });
      return;
    }

    const formData = new FormData();
    formData.set("submissionId", submissionId);
    formData.set("comparisonTotal", comparisonTotal.trim());
    formData.set("restaurantFound", restaurantFound);
    formData.set("comparisonLocationNote", locationNote);
    formData.set("adminNotes", notes);

    startTransition(async () => {
      const result = await saveComparison(formData);
      setFeedback({ ok: result.ok, message: result.message ?? (result.ok ? "Saved." : "Failed.") });
    });
  };

  const fieldClass =
    "min-h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900";

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <h2 className="text-base font-semibold text-ink-900">Comparison</h2>
      <p className="mt-1 text-sm text-ink-500">
        Rebuild this basket on {comparisonApp}, then enter the final total you see at checkout.
      </p>

      <div className="mt-5 space-y-4">
        <AmountInput
          label={`${comparisonApp} total`}
          value={comparisonTotal}
          onChange={(event) => setComparisonTotal(event.target.value)}
          error={inputError}
          placeholder="63.00"
        />

        <div>
          <label htmlFor="restaurant-found" className="mb-1.5 block text-sm font-semibold text-ink-900">
            Restaurant found <span className="font-normal text-ink-400">(internal)</span>
          </label>
          <input
            id="restaurant-found"
            className={fieldClass}
            value={restaurantFound}
            onChange={(event) => setRestaurantFound(event.target.value)}
            placeholder="e.g. Al Reef Bakery"
          />
        </div>

        <div>
          <label htmlFor="location-note" className="mb-1.5 block text-sm font-semibold text-ink-900">
            {comparisonApp} branch / location{" "}
            <span className="font-normal text-ink-400">(internal)</span>
          </label>
          <input
            id="location-note"
            className={fieldClass}
            value={locationNote}
            onChange={(event) => setLocationNote(event.target.value)}
            placeholder="e.g. Karama Test 01"
          />
        </div>

        <div>
          <label htmlFor="admin-notes" className="mb-1.5 block text-sm font-semibold text-ink-900">
            Notes <span className="font-normal text-ink-400">(internal)</span>
          </label>
          <textarea
            id="admin-notes"
            rows={3}
            className="w-full rounded-xl border border-ink-200 bg-white p-3.5 text-sm text-ink-900"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything worth remembering about this basket."
          />
        </div>
      </div>

      {preview ? (
        <div
          className={`mt-5 rounded-2xl border p-4 ${
            preview.saving.hasSaving
              ? "border-emerald-300 bg-emerald-50"
              : "border-ink-200 bg-ink-50"
          }`}
        >
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink-500">{sourceAppLabel}</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink-900">
                {formatMinorAsCurrency(currentMinor)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">{comparisonApp}</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink-900">
                {formatMinorAsCurrency(preview.minor)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-ink-200/70 pt-3">
            {preview.saving.hasSaving ? (
              <>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                  You found
                </p>
                <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-emerald-800">
                  {formatMinorAsCurrency(preview.saving.savingMinor)} saving
                </p>
                <p className="text-sm font-semibold text-emerald-700">
                  {preview.saving.savingPercentage.toFixed(1)}%
                </p>
              </>
            ) : (
              <p className="flex items-start gap-2 text-sm font-semibold text-ink-700">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                No cheaper option found on {comparisonApp}.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p
          role="status"
          className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm font-medium ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{feedback.message}</span>
        </p>
      ) : null}

      <div className="mt-5">
        <Button onClick={onSave} loading={pending} loadingLabel="Saving…" size="md">
          <Calculator aria-hidden="true" className="h-4 w-4" />
          Save comparison &amp; generate result
        </Button>
      </div>
    </section>
  );
}
