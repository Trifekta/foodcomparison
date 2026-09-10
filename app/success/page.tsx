import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Check } from "lucide-react";
import { Wordmark } from "@/components/customer/Wordmark";
import { Burst } from "@/components/customer/Burst";
import { Disclaimer } from "@/components/customer/Disclaimer";
import { isValidReferenceNumber } from "@/lib/utils/reference";
import { COMPARISON_APP } from "@/lib/constants";

export const metadata: Metadata = {
  title: "We're checking your order",
  robots: { index: false, follow: false },
};

/**
 * Confirmation screen.
 *
 * It echoes the reference from the URL and nothing else. There is deliberately
 * no lookup here: a reference number grants access to no data, so guessing one
 * reveals nothing about another customer.
 */
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const reference = ref && isValidReferenceNumber(ref) ? ref : null;

  return (
    <div className="flex min-h-dvh flex-col bg-brand-300">
      {/* Yellow celebration band */}
      <div className="px-5 pb-9 pt-6">
        <div className="mx-auto w-full max-w-md">
          <Wordmark size="sm" />

          <div className="relative mx-auto mt-8 flex h-[110px] w-[132px] items-center justify-center">
            <Burst className="absolute inset-0 h-full w-full text-ink-900/25" />
            <span className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-brand-500">
              <Check aria-hidden="true" strokeWidth={3.5} className="h-9 w-9 text-ink-900" />
            </span>
          </div>

          <p className="mt-3 text-center text-sm font-bold text-ink-800">Order received</p>
          <h1 className="mt-1.5 text-center text-[1.85rem] font-extrabold leading-tight text-ink-900">
            We&apos;re checking your order
          </h1>
        </div>
      </div>

      {/* White sheet */}
      <div className="flex flex-1 flex-col rounded-t-[2rem] bg-white px-5 pb-6 pt-7 safe-bottom">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <p className="text-center text-base leading-relaxed text-ink-500">
            We&apos;ll rebuild your basket on {COMPARISON_APP} and send your result soon.
          </p>

          {reference ? (
            <div className="mt-6 rounded-3xl bg-ink-50 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Reference</p>
              <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink-900">
                {reference}
              </p>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-400">
                <Bookmark aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                Screenshot this page to keep your reference.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl bg-ink-50 p-5 text-center">
              <p className="text-sm text-ink-500">
                Your order was received. Check the message we send you for your reference.
              </p>
            </div>
          )}

          <Link
            href="/compare"
            className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full border border-ink-200 bg-white px-6 text-base font-bold text-ink-800 hover:bg-ink-50"
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
