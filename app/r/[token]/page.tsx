import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicResult } from "@/lib/submissions/result";
import { ResultView } from "@/components/customer/ResultView";

/**
 * The customer's result page.
 *
 * Addressed by a 128-bit token rather than the reference number, because this
 * page shows a basket, a price and a saving: the reference is four random
 * digits and a date, which is fine for something people quote and useless as a
 * key to anything worth protecting.
 *
 * Rendered on every request. The whole point is a page whose answer arrives
 * later, so nothing about it may be cached or prerendered.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your price check",
  // Never indexed and never sent as a referrer: the URL is the credential.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicResult(token);

  // A bad token and a token that never existed are the same 404. Anything else
  // tells someone whether they are close.
  if (!result) notFound();

  return <ResultView initial={result} token={token} />;
}
