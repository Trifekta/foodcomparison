import type { SubmissionStatus } from "@/types/database";
import { STATUS_STYLES, statusLabel } from "@/lib/utils/status";
import { cn } from "@/lib/utils/cn";

export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        STATUS_STYLES[status],
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
