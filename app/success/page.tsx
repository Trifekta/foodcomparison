import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/customer/Wordmark";
import { CopyReference } from "@/components/customer/CopyReference";
import { Disclaimer } from "@/components/customer/Disclaimer";
import { TickBadge } from "@/components/customer/FoodArt";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import {
  BrandTagline,
  ScriptBubble,
  ScriptNote,
  SkylineFooter,
  Sparks,
} from "@/components/customer/Motifs";
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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-start justify-between gap-3 pt-5">
        <Wordmark size="md" />
        <ScriptNote underline className="text-[0.95rem] text-slate-600">
          Same Food
          <br />
          Lower Prices
        </ScriptNote>
      </header>

      {/* Celebration scene */}
      <div className="relative mt-3 h-64">
        <div
          aria-hidden="true"
          className="absolute inset-x-2 bottom-2 top-8 rounded-[3rem] bg-linear-to-b from-brand-100 to-beige"
        />
        <FoodPhoto
          name="celebration"
          eager
          className="pointer-events-none absolute inset-x-4 bottom-0 select-none"
        />

        {/* Badge sits in front of the spread, as in the reference */}
        <TickBadge className="absolute left-1/2 top-0 z-10 h-24 w-24 -translate-x-1/2 drop-shadow-lg" />
        <Sparks className="absolute left-[28%] top-2 z-10 h-7 w-7" />
        <Sparks className="absolute right-[28%] top-2 z-10 h-7 w-7 -scale-x-100" />

        <ScriptBubble className="absolute left-0 top-[38%] text-[0.72rem]">
          You&apos;re
          <br />
          all set!
        </ScriptBubble>
        <ScriptBubble className="absolute right-0 top-[42%] text-[0.72rem]">
          We&apos;ll
          <br />
          compare
          <br />
          for you
        </ScriptBubble>
      </div>

      <p className="mt-5 text-[0.82rem] font-bold uppercase tracking-[0.16em] text-slate-500">
        Price check received
      </p>
      <h1 className="relative mt-1 inline-flex items-start text-[2.1rem] font-extrabold leading-[1.12] text-ink-900">
        We&apos;re checking your order
        <Sparks className="ml-1 h-5 w-5 shrink-0" />
      </h1>
      <p className="mt-2.5 text-[1.02rem] leading-relaxed text-slate-600">
        We&apos;ll check the same restaurant and items on {COMPARISON_APP} and send your result
        soon.
      </p>

      {reference ? (
        <div className="mt-5 flex items-center gap-3 rounded-3xl bg-cream px-4 py-4 ring-1 ring-sand">
          <div className="min-w-0 flex-1">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-slate-500">
              Reference
            </p>
            <p className="mt-1 truncate text-[1.6rem] font-extrabold tracking-tight text-ink-900">
              {reference}
            </p>
          </div>
          <CopyReference reference={reference} />
        </div>
      ) : (
        <div className="mt-5 rounded-3xl bg-cream px-4 py-4 text-center ring-1 ring-sand">
          <p className="text-sm text-slate-600">
            Your price check was received. Check the message we send you for your reference.
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-ink-100 pt-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="relative shrink-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25d366] text-sm font-black text-white">
              W
            </span>
            <Sparks className="absolute -right-3 -top-1 h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[1rem] font-extrabold text-ink-900">
              We&apos;ll send your result to the contact you gave us
            </p>
            <p className="mt-0.5 text-[0.9rem] text-slate-500">
              You&apos;ll hear from us as soon as it&apos;s ready. Nothing has been ordered.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <Link
          href="/compare"
          className="relative inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-400 px-6 text-base font-bold text-ink-900 shadow-sm transition-colors hover:bg-brand-300"
        >
          Check another order
          <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5" />
        </Link>
      </div>

      <footer className="relative mt-6 border-t border-ink-100 pt-4">
        <SkylineFooter className="absolute inset-x-0 bottom-0 -z-10" />
        <div className="flex items-end justify-between gap-4 pb-4">
          <div className="max-w-[62%]">
            <Disclaimer />
            <p className="mt-2 text-xs">
              <Link href="/privacy" className="text-slate-500 underline underline-offset-2 hover:text-ink-800">
                Privacy
              </Link>
            </p>
          </div>
          <BrandTagline />
        </div>
      </footer>
    </div>
  );
}
