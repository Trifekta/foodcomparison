/**
 * The primary action of a step, kept within reach of a thumb.
 *
 * Sticky rather than fixed, which is the whole design of it:
 *
 *  - fixed takes the bar out of the flow, so it sits ON the content and the
 *    last thing on every screen has to be padded around it forever.
 *  - fixed and the iOS keyboard disagree. The keyboard shrinks the visual
 *    viewport but not the layout viewport, so a fixed bar strands itself behind
 *    the keys - which on this product would be the Continue button on the one
 *    screen that has a text field open.
 *
 * Sticky is in the flow. It rides the bottom of the screen while there is more
 * below, and comes to rest at its own place when the page ends, so it is never
 * covering anything and never needs to be worked around. The keyboard pushes it
 * exactly as it pushes everything else.
 *
 * The bar spans the full width by cancelling the shell's side padding, because
 * a rule that stops short of the edges reads as a box on a page rather than the
 * bottom of a screen.
 */
export function StepActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="safe-bottom-tight sticky bottom-0 z-10 -mx-5 mt-6 border-t border-ink-100 bg-canvas/95 px-5 pt-3 backdrop-blur">
      {children}
    </div>
  );
}
