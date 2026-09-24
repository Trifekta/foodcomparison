"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteVisit } from "@/lib/admin/visit-actions";

export function DeleteVisitButton({ visitId, reference }: { visitId: string; reference: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`Delete visit ${visitId.slice(0, 8)}`}
        onClick={() => {
          const confirmed = window.confirm(
            `Delete visit ${visitId}?\n\nThis removes its Visit History events, live presence and IP validation record. ${reference ? `The submission ${reference} stays in your orders. ` : ""}Keeta click records also stay. This cannot be undone.\n\nIf the visitor keeps using the site, new events may appear again.`,
          );
          if (!confirmed) return;
          setError(null);
          startTransition(async () => {
            try {
              const result = await deleteVisit(visitId);
              if (!result.ok) {
                setError(result.message ?? "Could not delete this visit. Please try again.");
                return;
              }
              router.refresh();
            } catch {
              setError("Could not delete this visit. Please try again.");
            }
          });
        }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? <p role="alert" className="max-w-48 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
