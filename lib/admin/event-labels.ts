import { FUNNEL_STEP_LABELS } from "@/lib/analytics/funnel";

/**
 * A history row's label, for a list that now shows two kinds of event.
 *
 * The submission history reads submission_events - what an admin did to an
 * order - and funnel_events, what the customer's browser recorded on the way
 * to placing it. Only the first kind is named here. The second already has
 * canonical labels in FUNNEL_STEP_LABELS, and copying them into a second map
 * is how "Scrolled three quarters" in one view becomes "Scrolled 3/4" in
 * another: the same event, two names, and no way to tell which is current.
 *
 * Anything neither map knows falls back to its own name with the underscores
 * taken out, which is what this list did for everything before it existed.
 */
const ADMIN_ACTIONS: Record<string, string> = {
  submission_created: "Order received",
  review_started: "Review started",
  comparison_added: "Comparison added",
  status_changed: "Status changed",
  result_generated: "Result generated",
  result_sent: "Result sent",
  submission_edited: "Order edited",
  submission_archived: "Archived",
  submission_unarchived: "Restored from archive",
};

export function eventLabel(eventType: string): string {
  return (
    ADMIN_ACTIONS[eventType] ??
    FUNNEL_STEP_LABELS[eventType] ??
    eventType.replace(/_/g, " ")
  );
}
