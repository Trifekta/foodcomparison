import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/customer/BrandHeader";
import { COMPARISON_APP } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Couldn't open ${COMPARISON_APP}`,
  robots: { index: false, follow: false },
};

/**
 * Where a switch lands when there is nothing safe to send somebody to.
 *
 * Reached only when the redirect refused: an unknown token, a comparison that
 * has been deleted, a missing link, or a destination that is not an approved
 * address. The customer is one tap from a restaurant and has just been stopped,
 * so this says so plainly and gives them the two things they can actually do -
 * go back to their result, or find it again - rather than an error code.
 *
 * The reason arrives as a short opaque word in the query string. It is written
 * by our own redirect and read only to choose a sentence; nothing from it is
 * rendered, so a hand-edited value changes the wording and can say nothing.
 */

const REASONS: Record<string, string> = {
  nolink: `We haven't saved the ${COMPARISON_APP} link for this order yet. It should appear on your result in a moment.`,
  blocked: `The link saved for this order doesn't point at ${COMPARISON_APP}, so we didn't send you to it.`,
  unknown: "This link has expired, or the order it belongs to is no longer here.",
  error: "Something went wrong at our end. Your order and your result are safe.",
};

export default async function KeetaUnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ why?: string }>;
}) {
  const { why } = await searchParams;
  const explanation = REASONS[why ?? ""] ?? REASONS.unknown;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <BrandHeader />
      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-extrabold text-ink-900">
          We couldn&apos;t open {COMPARISON_APP}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-ink-600">{explanation}</p>

        <Link
          href="/find"
          className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-400 px-7 text-base font-bold text-ink-900"
        >
          Find my order
        </Link>
        <Link
          href="/"
          className="mt-3 text-[0.95rem] font-semibold text-ink-600 underline underline-offset-2"
        >
          Back home
        </Link>
      </main>
    </div>
  );
}
