import type { SubmissionStatus } from "@/types/database";

/**
 * Technical enum values stay in the database; humans only ever see these labels.
 * Status is always communicated with its text label, never with colour alone.
 */
export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  comparison_found: "Comparison Added",
  no_saving: "No Saving Found",
  unavailable: "Couldn't Compare",
  result_ready: "Result Ready",
  result_sent: "Sent",
  cancelled: "Cancelled",
};

export const STATUS_ORDER: SubmissionStatus[] = [
  "new",
  "reviewing",
  "comparison_found",
  "result_ready",
  "no_saving",
  "unavailable",
  "result_sent",
  "cancelled",
];

/** Tailwind classes per status. Paired with the text label, never used alone. */
export const STATUS_STYLES: Record<SubmissionStatus, string> = {
  new: "bg-amber-100 text-amber-900 ring-amber-300",
  reviewing: "bg-sky-100 text-sky-900 ring-sky-300",
  comparison_found: "bg-indigo-100 text-indigo-900 ring-indigo-300",
  no_saving: "bg-slate-100 text-slate-700 ring-slate-300",
  unavailable: "bg-orange-100 text-orange-900 ring-orange-300",
  result_ready: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  result_sent: "bg-emerald-700 text-white ring-emerald-800",
  cancelled: "bg-rose-100 text-rose-900 ring-rose-300",
};

export function statusLabel(status: SubmissionStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function isCompletedStatus(status: SubmissionStatus): boolean {
  return (
    status === "result_ready" ||
    status === "no_saving" ||
    // Finished, even though no price was ever found: there is nothing further
    // anyone can do with it, and leaving it out of "completed" makes the queue
    // look permanently behind.
    status === "unavailable" ||
    status === "result_sent"
  );
}
