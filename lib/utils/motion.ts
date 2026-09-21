/**
 * Moving the page without startling anybody.
 *
 * Honoured for anybody who has asked their system for less movement, which is
 * a real setting for real reasons: for some people a smooth scroll is not
 * pleasant, it is nauseating. They get an instant move instead, which is the
 * lesser cost of the two.
 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "auto";
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  } catch {
    return "auto";
  }
}
