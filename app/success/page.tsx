import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Bookmark } from "lucide-react";
import { BrandHeader } from "@/components/customer/BrandHeader";
import { Disclaimer } from "@/components/customer/Disclaimer";
import { isValidReferenceNumber } from "@/lib/utils/reference";

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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <BrandHeader />

      <main className="flex flex-1 flex-col items-center pt-10 text-center">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"
        >
          <CheckCircle2 className="h-8 w-8 text-emerald-700" />
        </span>

        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink-900">
          Your order is being checked
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          We&apos;ll compare your basket and send your result soon.
        </p>

        {reference ? (
          <div className="mt-8 w-full rounded-2xl border border-ink-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Reference</p>
            <p className="mt-1.5 text-xl font-bold tracking-wide text-ink-900">{reference}</p>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-500">
              <Bookmark aria-hidden="true" className="h-3.5 w-3.5" />
              Save this page or screenshot it to keep your reference.
            </p>
          </div>
        ) : (
          <div className="mt-8 w-full rounded-2xl border border-ink-200 bg-white p-5">
            <p className="text-sm text-ink-600">
              Your order was received. Check the message we send you for your reference.
            </p>
          </div>
        )}

        <Link
          href="/compare"
          className="mt-8 inline-flex min-h-13 w-full items-center justify-center rounded-xl border border-ink-200 bg-white px-5 text-base font-semibold text-ink-800 hover:bg-ink-50"
        >
          Check another order
        </Link>
      </main>

      <footer className="mt-10 border-t border-ink-200 py-6 safe-bottom">
        <Disclaimer />
        <p className="mt-3 text-xs text-ink-500">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink-800">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}
