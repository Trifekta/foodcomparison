"use client";

import { useMemo, useState, useTransition } from "react";
import { Calculator, CheckCircle2 } from "lucide-react";
import { saveComparison } from "@/lib/admin/actions";
import { ADMIN_SOURCE_APPS, UNKNOWN_SOURCE_APP } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { AmountInput } from "@/components/forms/AmountInput";
import { calculateSaving } from "@/lib/calculations/saving";
import { MoneyParseError, parseAmountToMinor } from "@/lib/calculations/money";
import { PriceVerdict } from "@/components/admin/PriceVerdict";
import { comparisonTotalSchema } from "@/lib/validation/admin";

interface ComparisonPanelProps {
  submissionId: string;
  comparisonApp: string;
  currentTotal: string;
  areaName: string;
  initial: {
    /** What the order came from, as stored. "Unknown" until someone looks. */
    sourceApp: string;
    comparisonUrl: string;
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
  currentTotal,
  areaName,
  initial,
}: ComparisonPanelProps) {
  const [sourceApp, setSourceApp] = useState(initial.sourceApp);
  const [comparisonUrl, setComparisonUrl] = useState(initial.comparisonUrl);
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

  // A link that will not become a button is worth saying so before saving,
  // not discovering when the customer's result has no button on it.
  const trimmedUrl = comparisonUrl.trim();
  const urlError =
    trimmedUrl === "" || /^https:\/\/\S+$/i.test(trimmedUrl)
      ? undefined
      : "Paste the full https:// link from the app.";

  const validation = comparisonTotalSchema.safeParse(comparisonTotal);
  const inputError =
    comparisonTotal.trim() === "" ? undefined : validation.success ? undefined : validation.error.issues[0]?.message;

  const onSave = () => {
    if (!validation.success) {
      setFeedback({ ok: false, message: validation.error.issues[0]?.message ?? "Check the total." });
      return;
    }
    if (urlError) {
      setFeedback({ ok: false, message: urlError });
      return;
    }

    const formData = new FormData();
    formData.set("submissionId", submissionId);
    formData.set("comparisonTotal", comparisonTotal.trim());
    formData.set("sourceApp", sourceApp);
    formData.set("comparisonUrl", comparisonUrl.trim());
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

  // Rows created before this was an admin field can hold anything, including a
  // legacy "Other" plus a free-text name. Show what is stored rather than
  // silently reassigning it to something from the list.
  const knownApp = (ADMIN_SOURCE_APPS as readonly string[]).includes(sourceApp);

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <h2 className="text-base font-semibold text-ink-900">Comparison</h2>
      <p className="mt-1 text-sm text-ink-500">
        Rebuild this basket on {comparisonApp}, then enter the final total you see at checkout.
      </p>

      <div className="mt-5 space-y-4">
        {/*
          The customer is never asked this - the screenshots are right there on
          the left of this page and the app is obvious from them. Set here
          because this is where the customer's message gets written, and the
          message names the app.
        */}
        <div>
          <label htmlFor="source-app" className="mb-1.5 block text-sm font-semibold text-ink-900">
            Ordered on{" "}
            {sourceApp === UNKNOWN_SOURCE_APP ? (
              <span className="font-normal text-amber-700">— check the screenshot</span>
            ) : null}
          </label>
          <select
            id="source-app"
            className={fieldClass}
            value={knownApp ? sourceApp : ""}
            onChange={(event) => setSourceApp(event.target.value)}
          >
            {knownApp ? null : <option value="">{sourceApp}</option>}
            {ADMIN_SOURCE_APPS.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>
        </div>

        <AmountInput
          label={`${comparisonApp} total`}
          value={comparisonTotal}
          onChange={(event) => setComparisonTotal(event.target.value)}
          error={inputError}
          placeholder="63.00"
        />

        {/*
          Pasted from the page being rebuilt, not derived from anything. It
          becomes the button at the bottom of the customer's result, so the
          customer lands on the restaurant rather than the app's home screen.
        */}
        <div>
          <label htmlFor="comparison-url" className="mb-1.5 block text-sm font-semibold text-ink-900">
            {comparisonApp} restaurant link{" "}
            <span className="font-normal text-ink-400">(becomes the customer&apos;s button)</span>
          </label>
          <input
            id="comparison-url"
            type="url"
            inputMode="url"
            className={fieldClass}
            value={comparisonUrl}
            onChange={(event) => setComparisonUrl(event.target.value)}
            placeholder={`https://…  — share link from the ${comparisonApp} app`}
            aria-invalid={urlError ? true : undefined}
          />
          {urlError ? <p className="mt-1.5 text-sm text-rose-700">{urlError}</p> : null}
        </div>

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
        <div className="mt-5">
          <PriceVerdict
            sourceAppLabel={sourceApp === UNKNOWN_SOURCE_APP ? "Your order" : sourceApp}
            comparisonAppLabel={comparisonApp}
            currentTotalMinor={currentMinor}
            comparisonTotalMinor={preview.minor}
            saving={preview.saving}
            checks={[
              restaurantFound.trim() || "Same restaurant",
              "Same items",
              locationNote.trim() || areaName,
            ].filter(Boolean)}
          />
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
