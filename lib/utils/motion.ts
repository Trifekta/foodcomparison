/**
 * Moving the page without startling anybody.
 *
 * The wizard changes screens on its own, which means the page moves without a
 * tap to explain it. Jumping the scroll position at that moment reads as a
 * glitch - the screen simply IS somewhere else - where a roll reads as travel,
 * and travel is what tells somebody they have gone from one place to another
 * rather than that something broke.
 *
 * Honoured for anybody who has asked their system for less movement, which is
 * a real setting for real reasons: for some people a smooth scroll is not
 * pleasant, it is nauseating. They get the instant jump instead, which is the
 * lesser cost of the two.
 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "auto";
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  } catch {
    // Ancient or unusual browsers. A jump is survivable; an exception here is
    // not, because this runs on the path that changes screens.
    return "auto";
  }
}
