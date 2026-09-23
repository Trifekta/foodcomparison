/** Keep guided targets below the browser chrome, including in older WebViews. */
export function scrollToGuidedTarget(target: HTMLElement | null) {
  if (!target) return;
  try {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    // Older embedded WebViews may reject the options object.
    const top = window.scrollY + target.getBoundingClientRect().top - 96;
    window.scrollTo(0, Math.max(0, top));
  }
}
