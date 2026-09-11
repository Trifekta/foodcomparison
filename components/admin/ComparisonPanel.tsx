"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, Calculator, CheckCircle2 } from "lucide-react";
import { markUnavailable, saveComparison } from "@/lib/admin/actions";
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
  // Which ending this submission is getting. "priced" is the ordinary one; the
  // other exists because a basket that is not on the comparison app has no
  // total to enter, and before this it had nowhere to go at all.
  const [outcome, setOutcome] = useState<"priced" | "unavailable">("priced");
  const [reason, setReason] = useState<
    "restaurant_not_listed" | "items_not_available" | "other"
  >("restaurant_not_listed");
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

  const onSaveUnavailable = () => {
    const formData = new FormData();
    formData.set("submissionId", submissionId);
    formData.set("reason", reason);
    formData.set("adminNotes", notes);

    startTransition(async () => {
      const result = await markUnavailable(formData);
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

      {/*
        Which ending this is, chosen before anything is typed. A basket that is
        not on the comparison app has no total, and the form below spends most
        of its fields asking for one - so it is hidden rather than left to be
        filled in with something invented.
      */}
      <div className="mt-4 flex gap-2" role="group" aria-label="Outcome">
        {(
          [
            ["priced", `Found it on ${comparisonApp}`],
            ["unavailable", "Couldn't compare"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setOutcome(value);
              setFeedback(null);
            }}
            aria-pressed={outcome === value}
            className={`min-h-10 flex-1 rounded-xl border px-3 text-sm font-semibold ${
              outcome === value
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={outcome === "priced" ? "mt-5 space-y-4" : "hidden"}>
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

      {outcome === "unavailable" ? (
        <div className="mt-5 space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink-900">
              What stopped it?
            </legend>
            <p className="mb-2 text-sm text-ink-500">
              The customer is told the same thing either way. This is so we can
              tell a gap in {comparisonApp}&apos;s restaurant list from a gap in one menu.
            </p>
            <div className="space-y-2">
              {(
                [
                  ["restaurant_not_listed", `Restaurant isn't on ${comparisonApp}`],
                  ["items_not_available", `It's on ${comparisonApp}, but these items aren't`],
                  ["other", "Something else"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink-200 bg-white p-3 text-sm text-ink-900 hover:bg-ink-50"
                >
                  <input
                    type="radio"
                    name="unavailable-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="h-4 w-4 accent-ink-900"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="unavailable-notes"
              className="mb-1.5 block text-sm font-semibold text-ink-900"
            >
              Notes <span className="font-normal text-ink-400">(internal)</span>
            </label>
            <textarea
              id="unavailable-notes"
              rows={3}
              className="w-full rounded-xl border border-ink-200 bg-white p-3.5 text-sm text-ink-900"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything worth remembering — searched spellings, nearby branches."
            />
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            No price is saved and no saving is calculated. The customer gets a message
            saying we couldn&apos;t compare this one.
          </p>
        </div>
      ) : null}

      {outcome === "priced" && preview ? (
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
        {outcome === "priced" ? (
          <Button onClick={onSave} loading={pending} loadingLabel="Saving…" size="md">
            <Calculator aria-hidden="true" className="h-4 w-4" />
            Save comparison &amp; generate result
          </Button>
        ) : (
          <Button onClick={onSaveUnavailable} loading={pending} loadingLabel="Saving…" size="md">
            <Ban aria-hidden="true" className="h-4 w-4" />
            Record &amp; generate message
          </Button>
        )}
      </div>
    </section>
  );
}
