"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Eye, Loader2, Plus, ScanText, Trash2 } from "lucide-react";
import { releaseOcrWorker } from "@/lib/ocr/browser";
import {
  confirmExtraction,
  extractFromOcrText,
  extractWithVision,
} from "@/lib/extraction/actions";
import { emptyBasket, type StructuredBasket, type StructuredItem } from "@/lib/extraction/schema";

interface ExtractionPanelProps {
  submissionId: string;
  /** Signed, short-lived. Used to pull the image into the browser for OCR. */
  cartImageUrl: string | null;
  configured: boolean;
  /** The most recent run, so a reload does not lose an unconfirmed result. */
  previous: {
    id: string;
    method: "ocr_llm" | "vision";
    structured: StructuredBasket | null;
    confirmedAt: string | null;
    ocrConfidence: number | null;
  } | null;
}

type Phase = "idle" | "reading" | "structuring" | "review" | "saving";

const MONEY_FIELDS = [
  ["subtotal", "Subtotal"],
  ["delivery_fee", "Delivery fee"],
  ["service_fee", "Service fee"],
  ["discount", "Discount"],
  ["final_total", "Final total"],
] as const;

/**
 * Admin-assisted basket extraction.
 *
 * The normal route reads the screenshot with OCR **in this browser** and sends
 * only the resulting text to be structured - the image itself never goes to the
 * model. The vision fallback does send it, which is why it is a separate button
 * with its own confirmation rather than an automatic retry.
 *
 * Nothing here writes to the submission until the admin presses Confirm. What
 * the model produced and what the admin confirmed are stored separately, so the
 * difference between them stays measurable.
 */
export function ExtractionPanel({
  submissionId,
  cartImageUrl,
  configured,
  previous,
}: ExtractionPanelProps) {
  const [phase, setPhase] = useState<Phase>(
    previous?.structured && !previous.confirmedAt ? "review" : "idle",
  );
  const [draft, setDraft] = useState<StructuredBasket>(previous?.structured ?? emptyBasket());
  const [extractionId, setExtractionId] = useState<string | null>(previous?.id ?? null);
  const [method, setMethod] = useState<"ocr_llm" | "vision" | null>(previous?.method ?? null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(previous?.confirmedAt != null);

  // The WASM worker holds a few hundred MB; let it go when the page does.
  useEffect(() => () => void releaseOcrWorker(), []);

  const uncertain = new Set(draft.uncertain_fields);
  const flagged = (path: string) => uncertain.has(path);

  const patch = (changes: Partial<StructuredBasket>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const patchItem = (index: number, changes: Partial<StructuredItem>) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    }));

  const removeItem = (index: number) =>
    setDraft((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }));

  const addItem = () =>
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        { name: "", quantity: 1, modifiers: [], unit_price: "", line_total: "" },
      ],
    }));

  /** The default route: OCR here, text to the model. */
  const runOcrExtraction = async () => {
    if (!cartImageUrl) {
      setError("This submission has no cart screenshot.");
      return;
    }

    setError(null);
    setSaved(false);
    setPhase("reading");
    setProgress("starting");

    try {
      const { readImageInBrowser } = await import("@/lib/ocr/browser");
      const response = await fetch(cartImageUrl);
      if (!response.ok) throw new Error("The screenshot could not be downloaded.");

      const ocr = await readImageInBrowser(await response.blob(), setProgress, "staff");
      if (!ocr.ok) {
        setError(`${ocr.error} Try the vision fallback.`);
        setPhase("idle");
        return;
      }

      setPhase("structuring");
      const result = await extractFromOcrText({
        submissionId,
        text: ocr.text,
        confidence: ocr.confidence,
        engine: ocr.engine,
        durationMs: ocr.durationMs,
      });

      if (!result.ok || !result.basket || !result.extractionId) {
        setError(result.message ?? "The basket could not be extracted.");
        setPhase("idle");
        return;
      }

      setDraft(result.basket);
      setExtractionId(result.extractionId);
      setMethod("ocr_llm");
      setPhase("review");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The screenshot could not be read.");
      setPhase("idle");
    }
  };

  /** The fallback. Sends the image, so it asks first. */
  const runVisionExtraction = async () => {
    const agreed = window.confirm(
      "This sends the customer's screenshot itself to the model, rather than only text read from it. Use it when OCR has failed — poor Arabic, unreadable prices, missing items.\n\nSend the screenshot?",
    );
    if (!agreed) return;

    setError(null);
    setSaved(false);
    setPhase("structuring");

    const result = await extractWithVision(submissionId);

    if (!result.ok || !result.basket || !result.extractionId) {
      setError(result.message ?? "The screenshot could not be read.");
      setPhase("idle");
      return;
    }

    setDraft(result.basket);
    setExtractionId(result.extractionId);
    setMethod("vision");
    setPhase("review");
  };

  const save = async () => {
    if (!extractionId) return;
    setPhase("saving");
    setError(null);

    const result = await confirmExtraction({ submissionId, extractionId, basket: draft });

    if (!result.ok) {
      setError(result.message ?? "The basket could not be saved.");
      setPhase("review");
      return;
    }

    if (result.basket) setDraft(result.basket);
    setSaved(true);
    setPhase("review");
  };

  const busy = phase === "reading" || phase === "structuring" || phase === "saving";

  if (!configured) {
    return (
      <section className="rounded-2xl border border-dashed border-ink-300 bg-white p-5">
        <h2 className="text-base font-semibold text-ink-900">Extract basket</h2>
        <p className="mt-1.5 text-sm text-ink-500">
          Set <code className="rounded bg-ink-100 px-1">ANTHROPIC_API_KEY</code> to switch this on.
          Until then, rebuild the basket from the screenshot by hand.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-ink-900">Extract basket</h2>
        {method ? (
          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-600">
            {method === "ocr_llm" ? "OCR → text → model" : "vision fallback"}
          </span>
        ) : null}
        {saved ? (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-emerald-800">
            <Check aria-hidden="true" className="h-3 w-3" />
            confirmed
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-sm text-ink-500">
        The screenshot is read in your browser and only the text is sent on. Nothing is saved to
        the submission until you confirm it.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runOcrExtraction()}
          disabled={busy || !cartImageUrl}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
        >
          {phase === "reading" ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanText aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {phase === "review" || saved ? "Extract again" : "Extract basket"}
        </button>

        <button
          type="button"
          onClick={() => void runVisionExtraction()}
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          title="Sends the screenshot itself. Use only when OCR has failed."
        >
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          Use AI vision fallback
        </button>
      </div>

      {busy ? (
        <p aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-ink-600">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {phase === "reading"
            ? `Reading the screenshot in your browser… ${progress}`
            : phase === "structuring"
              ? "Structuring…"
              : "Saving…"}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
          {error}
        </p>
      ) : null}

      {phase === "review" || phase === "saving" ? (
        <div className="mt-4 border-t border-ink-200 pt-4">
          {draft.uncertain_fields.length > 0 ? (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{draft.uncertain_fields.length} field(s) flagged as uncertain.</strong> They
                are outlined below — check each against the screenshot before confirming.
              </span>
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Restaurant"
              value={draft.restaurant_name}
              flagged={flagged("restaurant_name")}
              onChange={(value) => patch({ restaurant_name: value })}
            />
            <Field
              label="Source app"
              value={draft.source_app}
              flagged={flagged("source_app")}
              onChange={(value) => patch({ source_app: value })}
            />
          </div>

          <h3 className="mt-4 text-sm font-semibold text-ink-900">Items</h3>
          <ul className="mt-2 space-y-2">
            {draft.items.map((item, index) => (
              <li key={index} className="rounded-xl border border-ink-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field
                      label={`Item ${index + 1}`}
                      value={item.name}
                      flagged={flagged(`items[${index}].name`)}
                      onChange={(value) => patchItem(index, { name: value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="mt-6 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Remove item ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <Field
                    label="Qty"
                    type="number"
                    value={String(item.quantity)}
                    flagged={flagged(`items[${index}].quantity`)}
                    onChange={(value) =>
                      patchItem(index, { quantity: Math.max(1, Number(value) || 1) })
                    }
                  />
                  <Field
                    label="Unit price"
                    value={item.unit_price}
                    flagged={flagged(`items[${index}].unit_price`)}
                    onChange={(value) => patchItem(index, { unit_price: value })}
                  />
                  <Field
                    label="Line total"
                    value={item.line_total}
                    flagged={flagged(`items[${index}].line_total`)}
                    onChange={(value) => patchItem(index, { line_total: value })}
                  />
                  <Field
                    label="Modifiers"
                    value={item.modifiers.join(", ")}
                    flagged={flagged(`items[${index}].modifiers`)}
                    onChange={(value) =>
                      patchItem(index, {
                        modifiers: value
                          .split(",")
                          .map((entry) => entry.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={addItem}
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-ink-300 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add item
          </button>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {MONEY_FIELDS.map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={draft[key]}
                flagged={flagged(key)}
                onChange={(value) => patch({ [key]: value } as Partial<StructuredBasket>)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-200 pt-4">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check aria-hidden="true" className="h-4 w-4" />
              {saved ? "Save changes" : "Confirm and save basket"}
            </button>
            <p className="text-xs text-ink-500">
              Saves the items above against this submission. The customer&apos;s own restaurant and
              total are never overwritten.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** One editable value. A flagged field is outlined, not just tinted. */
function Field({
  label,
  value,
  flagged,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  flagged: boolean;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-500">
        {label}
        {flagged ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 text-[0.6rem] font-bold uppercase text-amber-800">
            <AlertTriangle aria-hidden="true" className="h-2.5 w-2.5" />
            check
          </span>
        ) : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-9 w-full rounded-lg border bg-white px-2.5 text-sm text-ink-900 ${
          flagged ? "border-amber-400 bg-amber-50/40" : "border-ink-200"
        }`}
      />
    </label>
  );
}
