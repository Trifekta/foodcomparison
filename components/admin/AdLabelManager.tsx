"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import type { AdLabelRow } from "@/types/database";
import { createAdLabel, deleteAdLabel, updateAdLabel } from "@/lib/admin/actions";
import { resolveAdLabel, type AdLabelIndex, type AdLabelKind } from "@/lib/analytics/ad-labels";
import { Button } from "@/components/ui/Button";

/**
 * Naming the adverts.
 *
 * Adverts are data, not code: a creative launched this morning gets a name
 * here and every table reads it immediately, with no deploy. That is the whole
 * reason this screen exists rather than a longer list in
 * lib/analytics/ad-labels.ts - the built-ins there can only ever cover the
 * adverts that existed when somebody last edited the file.
 *
 * Nothing here changes what is captured or stored. The value column is a key
 * into rows that already exist; editing a label renames a heading and touches
 * no submission, click or event.
 */

const KINDS: { value: AdLabelKind; label: string; hint: string }[] = [
  { value: "source", label: "Source", hint: "utm_source — instagram, fb" },
  { value: "campaign", label: "Campaign", hint: "utm_campaign — {{campaign.id}}" },
  { value: "creative", label: "Ad / Creative", hint: "utm_content — {{ad.id}}" },
];

const KIND_LABEL = new Map(KINDS.map((kind) => [kind.value, kind.label]));

export interface SeenAdValue {
  kind: AdLabelKind;
  value: string;
  count: number;
}

export function AdLabelManager({
  labels,
  seen,
  index,
}: {
  labels: AdLabelRow[];
  /** Values that have actually arrived, so naming one is a tap not a hunt. */
  seen: SeenAdValue[];
  index: AdLabelIndex;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [prefill, setPrefill] = useState<SeenAdValue | null>(null);
  const [pending, startTransition] = useTransition();

  const inputClass =
    "min-h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900";

  const submit = (formData: FormData, action: typeof createAdLabel) => {
    startTransition(async () => {
      const result = await action(formData);
      setFeedback({ ok: result.ok, message: result.message ?? (result.ok ? "Saved." : "Failed.") });
      if (result.ok) {
        setEditingId(null);
        setPrefill(null);
      }
    });
  };

  const remove = (row: AdLabelRow) => {
    // A label owns no data - removing it puts the raw id back on screen and
    // takes nothing else with it - so one confirmation is the right amount.
    if (!window.confirm(`Remove the label "${row.label}"? The raw ID stays on every row.`)) return;
    startTransition(async () => {
      const result = await deleteAdLabel(row.id);
      setFeedback({ ok: result.ok, message: result.message ?? "Removed." });
    });
  };

  // Only the ones nothing already names. A value that resolves through a
  // database row or a built-in is not waiting for anybody.
  const unnamed = seen.filter((item) => resolveAdLabel(item.kind, item.value, index).origin === "id");

  return (
    <div className="space-y-5">
      {feedback ? (
        <p
          role="status"
          className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
            feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      {unnamed.length > 0 ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-ink-900">Seen in your data, not named yet</h2>
          <p className="mt-1 text-sm text-ink-600">
            These arrived on real visits and still read as raw IDs. Tap one to fill the form below.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {unnamed.map((item) => (
              <li key={`${item.kind}:${item.value}`}>
                <button
                  type="button"
                  onClick={() => setPrefill(item)}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-2 text-left hover:bg-amber-100"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    {KIND_LABEL.get(item.kind)}
                  </span>
                  <span className="font-mono text-xs text-ink-700">{item.value}</span>
                  <span className="text-xs text-ink-500">
                    {item.count} visit{item.count === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-base font-semibold text-ink-900">Add a label</h2>
        <form
          key={prefill ? `${prefill.kind}:${prefill.value}` : "blank"}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_1.4fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            submit(new FormData(form), createAdLabel);
            form.reset();
          }}
        >
          <div>
            <label htmlFor="new-label-kind" className="mb-1 block text-xs font-semibold text-ink-500">
              Kind
            </label>
            <select
              id="new-label-kind"
              name="kind"
              defaultValue={prefill?.kind ?? "creative"}
              className={inputClass}
            >
              {KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-label-value" className="mb-1 block text-xs font-semibold text-ink-500">
              Meta ID or utm value
            </label>
            <input
              id="new-label-value"
              name="value"
              required
              defaultValue={prefill?.value ?? ""}
              className={`${inputClass} font-mono`}
              placeholder="120249042878960301"
            />
          </div>
          <div>
            <label htmlFor="new-label-label" className="mb-1 block text-xs font-semibold text-ink-500">
              Reads as
            </label>
            <input
              id="new-label-label"
              name="label"
              required
              className={inputClass}
              placeholder="Take a Screenshot"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add
            </Button>
          </div>
        </form>
        <p className="mt-2 text-xs text-ink-500">
          Find the ID in Ads Manager, or tap one of the unnamed values above.
        </p>
      </section>

      <section className="rounded-2xl border border-ink-200 bg-white">
        <h2 className="border-b border-ink-100 px-5 py-3 text-base font-semibold text-ink-900">
          Saved labels
        </h2>

        {labels.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            Nothing saved yet. The sources and the two campaigns that were already running are
            named in code until you add rows here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-2.5">Kind</th>
                  <th className="px-5 py-2.5">Meta ID / value</th>
                  <th className="px-5 py-2.5">Reads as</th>
                  <th className="px-5 py-2.5">Notes</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {labels.map((row) =>
                  editingId === row.id ? (
                    <tr key={row.id}>
                      <td colSpan={5} className="px-5 py-3">
                        <form
                          className="grid gap-3 sm:grid-cols-[1fr_1.4fr_1.4fr_1.4fr_auto]"
                          onSubmit={(event) => {
                            event.preventDefault();
                            submit(new FormData(event.currentTarget), updateAdLabel);
                          }}
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <select name="kind" defaultValue={row.kind} className={inputClass}>
                            {KINDS.map((kind) => (
                              <option key={kind.value} value={kind.value}>
                                {kind.label}
                              </option>
                            ))}
                          </select>
                          <input
                            name="value"
                            defaultValue={row.value}
                            required
                            className={`${inputClass} font-mono`}
                          />
                          <input
                            name="label"
                            defaultValue={row.label}
                            required
                            className={inputClass}
                          />
                          <input
                            name="notes"
                            defaultValue={row.notes ?? ""}
                            className={inputClass}
                            placeholder="Audience, hook, anything worth remembering"
                          />
                          <div className="flex items-end gap-2">
                            <Button type="submit" disabled={pending}>
                              <Save aria-hidden="true" className="h-4 w-4" />
                              Save
                            </Button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="inline-flex min-h-10 items-center rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-600 hover:bg-ink-50"
                            >
                              <X aria-hidden="true" className="h-4 w-4" />
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                        {KIND_LABEL.get(row.kind) ?? row.kind}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-600">{row.value}</td>
                      <td className="px-5 py-3 font-medium text-ink-900">{row.label}</td>
                      <td className="px-5 py-3 text-ink-600">{row.notes ?? "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(row.id)}
                            className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(row)}
                            disabled={pending}
                            aria-label={`Remove the label ${row.label}`}
                            className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-ink-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
