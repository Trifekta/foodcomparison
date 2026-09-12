"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { deleteSubmission, setSubmissionArchived } from "@/lib/admin/actions";
import { cn } from "@/lib/utils/cn";

/**
 * Archive and delete, on one submission.
 *
 * Two buttons rather than a menu. There are only ever two, and a menu would put
 * a tap between the admin and the thing they came to do - while also hiding the
 * destructive one behind a gesture that reveals it without warning.
 *
 * Deleting asks first, in a confirm() rather than a modal of our own. It is the
 * one control here that cannot be undone, the browser's dialog cannot be
 * mis-styled into looking harmless, and a bespoke modal is a lot of surface for
 * a question with two answers.
 */
export function SubmissionRowActions({
  submissionId,
  reference,
  archivedAt,
  /** After a delete on the submission's own page, there is no page to go back to. */
  redirectAfterDelete = false,
  className,
}: {
  submissionId: string;
  reference: string;
  archivedAt: string | null;
  redirectAfterDelete?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isArchived = archivedAt !== null;

  const run = (action: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "That did not work. Please try again.");
        return;
      }
      after?.();
      router.refresh();
    });
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setSubmissionArchived(submissionId, !isArchived))}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
      >
        {isArchived ? (
          <ArchiveRestore aria-hidden="true" className="h-3.5 w-3.5" />
        ) : (
          <Archive aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {isArchived ? "Restore" : "Archive"}
        <span className="sr-only"> submission {reference}</span>
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const ok = window.confirm(
            `Delete ${reference}?\n\nThis removes the submission, its basket, its history and its screenshots. It cannot be undone.\n\nTo take it out of the list without losing it, use Archive instead.`,
          );
          if (!ok) return;
          run(
            () => deleteSubmission(submissionId),
            () => {
              if (redirectAfterDelete) router.push("/admin");
            },
          );
        }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        Delete
        <span className="sr-only"> submission {reference}</span>
      </button>

      {error ? (
        <p role="alert" className="ml-1 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
