import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, MessageCircle } from "lucide-react";
import { Wordmark } from "@/components/customer/Wordmark";
import { PriceCheckMark } from "@/components/customer/FoodArt";
import { Disclaimer } from "@/components/customer/Disclaimer";
import { isValidReferenceNumber } from "@/lib/utils/reference";
import { COMPARISON_APP } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Price check received",
  robots: { index: false, follow: false },
};

/**
 * Confirmation screen.
 *
 * It echoes the reference from the URL and nothing else. There is deliberately
 * no lookup here: a reference number grants access to no data, so guessing one
 * reveals nothing about another customer.
 *
 * Wording is careful on one point - nobody has ordered anything through us.
 * This confirms a price-check request, not a food order.
 */
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const reference = ref && isValidReferenceNumber(ref) ? ref : null;

  return (
    <div className="flex min-h-dvh flex-col bg-linear-to-b from-brand-300 to-flame-200">
      {/* Warm confirmation band */}
      <div className="px-5 pb-10 pt-6">
        <div className="mx-auto w-full max-w-md">
          <Wordmark size="sm" />

          <div className="mt-7 flex justify-center">
            <PriceCheckMark className="h-32 w-32 drop-shadow-sm" />
          </div>

          <p className="mt-4 text-center text-sm font-extrabold uppercase tracking-wide text-flame-700">
            Price check received
          </p>
          <h1 className="mt-1.5 text-center text-[1.85rem] font-extrabold leading-tight text-ink-900">
            We&apos;re checking your order
          </h1>
        </div>
      </div>

      {/* White sheet */}
      <div className="flex flex-1 flex-col rounded-t-[2rem] bg-white px-5 pb-6 pt-7 safe-bottom">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <p className="text-center text-base leading-relaxed text-ink-500">
            We&apos;ll check the same restaurant and items on {COMPARISON_APP} and send your result
            soon.
          </p>

          <p className="mt-4 flex items-start justify-center gap-2 rounded-2xl bg-cream px-4 py-3 text-sm text-ink-600 ring-1 ring-sand">
            <MessageCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
            <span>Your result arrives on the contact you gave us. Nothing has been ordered.</span>
          </p>

          {reference ? (
            <div className="mt-4 rounded-3xl bg-ink-900 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Reference</p>
              <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-brand-400">
                {reference}
              </p>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-400">
                <Bookmark aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                Screenshot this page to keep your reference.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-3xl bg-cream p-5 text-center ring-1 ring-sand">
              <p className="text-sm text-ink-500">
                Your price check was received. Check the message we send you for your reference.
              </p>
            </div>
          )}

          <Link
            href="/compare"
            className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-400 px-6 text-base font-bold text-ink-900 transition-colors hover:bg-brand-300"
          >
            Check another order
          </Link>

          <footer className="mt-auto pt-10">
            <Disclaimer />
            <p className="mt-3 text-xs text-ink-400">
              <Link href="/privacy" className="underline underline-offset-2 hover:text-ink-700">
                Privacy
              </Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
