"use client";

import { useState, useTransition } from "react";
import { Plus, Save } from "lucide-react";
import type { AreaRow } from "@/types/database";
import { createArea, toggleAreaActive, updateArea } from "@/lib/admin/actions";
import { Button } from "@/components/ui/Button";

/**
 * Area management.
 *
 * Areas are data, not code: adding, renaming, reordering or deactivating one
 * here changes the customer dropdown immediately, with no deploy.
 */
export function AreaManager({ areas }: { areas: AreaRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const inputClass =
    "min-h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900";

  const submit = (formData: FormData, action: typeof createArea) => {
    startTransition(async () => {
      const result = await action(formData);
      setFeedback({ ok: result.ok, message: result.message ?? (result.ok ? "Saved." : "Failed.") });
      if (result.ok) setEditingId(null);
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-base font-semibold text-ink-900">Add an area</h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            formData.set("active", "true");
            submit(formData, createArea);
            form.reset();
          }}
        >
          <div>
            <label htmlFor="new-area-name" className="mb-1 block text-xs font-semibold text-ink-500">
              Name
            </label>
            <input id="new-area-name" name="name" required className={inputClass} placeholder="Al Wasl" />
          </div>
          <div>
            <label htmlFor="new-area-sort" className="mb-1 block text-xs font-semibold text-ink-500">
              Sort order
            </label>
            <input
              id="new-area-sort"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={500}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-area-test" className="mb-1 block text-xs font-semibold text-ink-500">
              Test location label (internal)
            </label>
            <input id="new-area-test" name="testLocationLabel" className={inputClass} placeholder="Wasl Test 01" />
          </div>
          <div className="flex items-end">
            <Button type="submit" size="md" loading={pending} loadingLabel="Saving…">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add
            </Button>
          </div>
        </form>
      </section>

      {feedback ? (
        <p
          role="status"
          className={`rounded-xl border p-3 text-sm font-medium ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="rounded-2xl border border-ink-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Supported Dubai areas</caption>
          <thead>
            <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
              <th scope="col" className="px-4 py-3 font-semibold">Area</th>
              <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">Sort</th>
              <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">
                Test location (internal)
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {areas.map((area) =>
              editingId === area.id ? (
                <tr key={area.id} className="bg-brand-50/50">
                  <td colSpan={5} className="px-4 py-4">
                    <form
                      className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr_2fr_auto]"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        formData.set("id", area.id);
                        submit(formData, updateArea);
                      }}
                    >
                      <input
                        name="name"
                        defaultValue={area.name}
                        required
                        aria-label="Area name"
                        className={inputClass}
                      />
                      <input
                        name="sortOrder"
                        type="number"
                        min={0}
                        defaultValue={area.sort_order}
                        aria-label="Sort order"
                        className={inputClass}
                      />
                      <input
                        name="testLocationLabel"
                        defaultValue={area.test_location_label ?? ""}
                        placeholder="Test location label"
                        aria-label="Test location label"
                        className={inputClass}
                      />
                      <input
                        name="adminLocationNotes"
                        defaultValue={area.admin_location_notes ?? ""}
                        placeholder="Internal notes"
                        aria-label="Internal notes"
                        className={inputClass}
                      />
                      <input type="hidden" name="active" value={String(area.active)} />
                      <div className="flex items-center gap-2">
                        <Button type="submit" size="md" loading={pending} loadingLabel="Saving…">
                          <Save aria-hidden="true" className="h-4 w-4" />
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="md"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={area.id}>
                  <td className="px-4 py-3 font-medium text-ink-900">{area.name}</td>
                  <td className="hidden px-4 py-3 tabular-nums text-ink-600 sm:table-cell">
                    {area.sort_order}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">
                    {area.test_location_label ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                        area.active
                          ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                          : "bg-ink-100 text-ink-600 ring-ink-300"
                      }`}
                    >
                      {area.active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(area.id)}
                        className="min-h-9 rounded-lg border border-ink-200 px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await toggleAreaActive(area.id, !area.active);
                            if (!result.ok) {
                              setFeedback({ ok: false, message: result.message ?? "Failed." });
                            }
                          })
                        }
                        className="min-h-9 rounded-lg border border-ink-200 px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
                      >
                        {area.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
