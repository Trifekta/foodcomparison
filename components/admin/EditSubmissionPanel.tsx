"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { editSubmission } from "@/lib/admin/actions";
import { ADMIN_SOURCE_APPS, DIAL_CODES } from "@/lib/constants";
import type { PublicArea, SubmissionWithArea } from "@/types/database";

/**
 * Correcting what the customer sent.
 *
 * Collapsed by default. The submission page is somewhere an admin comes to do
 * the comparison, not to edit; a form permanently open above the basket invites
 * a stray keystroke into the number every other figure is derived from.
 *
 * Only the customer's own facts are here. The Keeta total, the saving and the
 * message belong to the comparison panel, which computes them - offering them
 * for hand-editing here would be a second way to set numbers that are supposed
 * to follow from one calculation.
 */

/** Splits a stored E.164 number back into the dial code and the rest. */
function splitPhone(e164: string | null): { dialCode: string; national: string } {
  if (!e164) return { dialCode: "+971", national: "" };
  const match = DIAL_CODES.map((entry) => entry.code)
    .sort((a, b) => b.length - a.length)
    .find((code) => e164.startsWith(code));
  if (!match) return { dialCode: "+971", national: e164.replace(/^\+/, "") };
  return { dialCode: match, national: e164.slice(match.length) };
}

export function EditSubmissionPanel({
  submission,
  areas,
}: {
  submission: SubmissionWithArea;
  areas: PublicArea[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const phone = splitPhone(submission.whatsapp_number);
  const [contactType, setContactType] = useState(submission.contact_type);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("submissionId", submission.id);

    startTransition(async () => {
      const result = await editSubmission(formData);
      if (!result.ok) {
        setError(result.message ?? "Could not save the changes.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        Edit details
      </button>
    );
  }

  const fieldClass =
    "min-h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900";
  const labelClass = "text-xs font-semibold text-ink-500";

  return (
    <form onSubmit={onSubmit} className="w-full rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink-900">Edit details</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-600 hover:bg-ink-50"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="edit-restaurant">
            Restaurant
          </label>
          <input
            id="edit-restaurant"
            name="restaurantName"
            defaultValue={submission.restaurant_name ?? ""}
            className={fieldClass}
            placeholder="As the customer named it"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="edit-area">
            Area
          </label>
          <select
            id="edit-area"
            name="areaId"
            defaultValue={submission.area_id ?? ""}
            className={fieldClass}
          >
            <option value="">Choose an area</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="edit-total">
            Customer total (AED)
          </label>
          <input
            id="edit-total"
            name="currentTotal"
            inputMode="decimal"
            defaultValue={submission.current_total}
            className={`${fieldClass} tabular-nums`}
          />
          <p className="text-xs text-ink-500">
            Every saving is measured against this, so correcting it changes the result.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="edit-app">
            Ordered from
          </label>
          <select
            id="edit-app"
            name="sourceApp"
            defaultValue={submission.source_app}
            className={fieldClass}
          >
            {ADMIN_SOURCE_APPS.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="edit-contact-type">
            Reply by
          </label>
          <select
            id="edit-contact-type"
            name="contactType"
            value={contactType}
            onChange={(event) => setContactType(event.target.value as "whatsapp" | "email")}
            className={fieldClass}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </div>

        {contactType === "whatsapp" ? (
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="edit-phone">
              WhatsApp number
            </label>
            <div className="flex gap-2">
              <select
                name="dialCode"
                aria-label="Country code"
                defaultValue={phone.dialCode}
                className={`${fieldClass} w-28`}
              >
                {DIAL_CODES.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <input
                id="edit-phone"
                name="whatsappNumber"
                inputMode="tel"
                defaultValue={phone.national}
                className={`${fieldClass} tabular-nums`}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="edit-email">
              Email
            </label>
            <input
              id="edit-email"
              name="email"
              type="email"
              defaultValue={submission.email ?? ""}
              className={fieldClass}
            />
          </div>
        )}
      </div>

      {/* The unused channel still posts, because the schema reads both and
          decides by contactType. Sending an empty one is what clears it. */}
      {contactType === "whatsapp" ? (
        <input type="hidden" name="email" value={submission.email ?? ""} />
      ) : (
        <>
          <input type="hidden" name="dialCode" value={phone.dialCode} />
          <input type="hidden" name="whatsappNumber" value={phone.national} />
        </>
      )}

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink-900 px-5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
