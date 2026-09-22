/**
 * Human-readable labels for funnel and side events in the admin dashboard.
 */

export function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    // Funnel steps
    wizard_started: "Entered upload page",
    cart_uploaded: "Cart screenshot uploaded",
    step_basket: "Moved to basket review",
    step_where: "Selected delivery area",
    step_review: "Moved to final review",
    submitted: "Submitted order",
    result_viewed: "Viewed comparison result",
    keeta_opened: "Opened Keeta",

    // Side events: pages
    landing_viewed: "Viewed landing page",

    // Side events: scroll depth
    scroll_0: "Didn't scroll",
    scroll_25: "Scrolled a quarter",
    scroll_50: "Scrolled halfway",
    scroll_75: "Scrolled 3/4",
    scroll_100: "Scrolled to bottom",
  };

  return labels[eventType] || eventType.replace(/_/g, " ");
}
