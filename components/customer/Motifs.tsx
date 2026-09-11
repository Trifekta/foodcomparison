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
 * Dubai skyline that closes every screen.
 *
 * The supplied illustration, in place of the flat cream silhouette this used to
 * draw by hand - the real landmarks are the point, since half of what the app
 * promises is that it knows this city.
 */
export function SkylineFooter({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative select-none", className)} aria-hidden="true">
      {/*
        The supplied Dubai skyline, served straight from /public like the food
        renders and for the same reason: next/image's optimiser needs a
        Cloudflare Images binding this Worker does not declare.

        It sits behind the footer text, so it is dialled back rather than shown
        at full strength - the artwork is a backdrop here, and a legible
        disclaimer matters more than a vivid Burj Khalifa.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/art/skyline.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        className="w-full opacity-60"
      />
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
