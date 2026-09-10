import { cn } from "@/lib/utils/cn";

/**
 * The small decorative marks that recur across every screen: radiating
 * "sparks", the Dubai skyline footer, and handwritten speech bubbles.
 * All decorative, so all hidden from assistive technology.
 */

/** Three short radiating strokes, used beside headings and icons. */
export function Sparks({ className, tone = "brand" }: { className?: string; tone?: "brand" | "ink" }) {
  const stroke = tone === "brand" ? "var(--color-brand-400)" : "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4 14 1.5 18.5" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 10.5 10.6 5" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17.5 13 21.5 9.5" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Handwritten note, optionally with the marker underline beneath it. */
export function ScriptNote({
  children,
  className,
  underline = false,
}: {
  children: React.ReactNode;
  className?: string;
  underline?: boolean;
}) {
  return (
    <span className={cn("script inline-block", className)}>
      {children}
      {underline ? (
        <span
          aria-hidden="true"
          className="mt-0.5 block h-[3px] w-3/5 rounded-full bg-brand-400"
        />
      ) : null}
    </span>
  );
}

/** Rounded speech bubble carrying a handwritten line. */
export function ScriptBubble({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "script inline-block rounded-[1.2rem] bg-white/90 px-3 py-1.5 text-center text-ink-800 shadow-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Dubai skyline that closes every screen, drawn as a single flat silhouette in
 * a barely-there cream so it reads as paper texture rather than content.
 */
export function SkylineFooter({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative select-none", className)} aria-hidden="true">
      <svg viewBox="0 0 390 90" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* dune */}
        <path d="M0 62c60-16 120 6 190-2s130-22 200-6v36H0z" fill="var(--color-brand-100)" opacity="0.55" />
        {/* skyline */}
        <g fill="var(--color-brand-200)" opacity="0.75">
          <rect x="24" y="58" width="14" height="32" rx="2" />
          <rect x="44" y="48" width="10" height="42" rx="2" />
          <rect x="60" y="64" width="16" height="26" rx="2" />
          <rect x="88" y="54" width="12" height="36" rx="2" />
          {/* Burj-like spire */}
          <path d="M188 90V34l4-24 4 24v56z" />
          <rect x="176" y="52" width="9" height="38" rx="2" />
          <rect x="199" y="46" width="9" height="44" rx="2" />
          <rect x="216" y="60" width="14" height="30" rx="2" />
          <rect x="242" y="50" width="11" height="40" rx="2" />
          <rect x="262" y="64" width="16" height="26" rx="2" />
          <rect x="292" y="56" width="12" height="34" rx="2" />
          <rect x="316" y="66" width="18" height="24" rx="2" />
          <rect x="346" y="58" width="12" height="32" rx="2" />
        </g>
      </svg>
    </div>
  );
}

/** The recurring sign-off, bottom right of most screens. */
export function BrandTagline({ className }: { className?: string }) {
  return (
    <p className={cn("script text-right text-[0.95rem] leading-tight text-slate-600", className)}>
      Good food
      <br />
      for a brighter UAE{" "}
      <span aria-hidden="true" className="text-brand-500">
        &hearts;
      </span>
      <span aria-hidden="true" className="mt-0.5 ml-auto block h-[3px] w-24 rounded-full bg-brand-400" />
    </p>
  );
}

/** Page footer: skyline behind, tagline on top. */
export function ScreenFooter({ className }: { className?: string }) {
  return (
    <div className={cn("relative mt-8", className)}>
      <SkylineFooter className="absolute inset-x-0 bottom-0 -z-10" />
      <div className="flex justify-end pb-3 pr-1 pt-6">
        <BrandTagline />
      </div>
    </div>
  );
}
