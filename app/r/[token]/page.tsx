import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicResult } from "@/lib/submissions/result";
import { ResultView } from "@/components/customer/ResultView";
import { getWebPushPublicKey } from "@/lib/env";
import { socialCard } from "@/lib/metadata";
import { PRODUCT_NAME } from "@/lib/constants";

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

  /**
   * The preview card for the one link this product actually sends.
   *
   * This link arrives on WhatsApp from a number the customer has never seen,
   * and a bare URL under a message about money is the exact shape people are
   * told not to tap. The card is the same argument the first line of the
   * message makes: put the mark on it, and it reads as the thing they asked
   * for rather than as a stranger's link.
   *
   * It is static, and says nothing about this basket. The preview is built on
   * the sender's device and travels inside the encrypted message, so there is
   * no scraper to leak the token to - but a restaurant name or a saving in a
   * meta tag would still be this customer's order sitting in a tag anybody
   * with the page can read, and it buys nothing. Everything specific stays
   * behind the token, on the page.
   *
   * No og:url: it would be this page's own address, and that address is the
   * credential. Repeating a secret in a tag is not how you make a card.
   */
  ...socialCard({
    title: `${PRODUCT_NAME} — your price check is ready`,
    description: "We compared your order. Open it to see the totals side by side.",
    image: "/og/result.png",
    imageAlt: `${PRODUCT_NAME} — your price check is ready.`,
  }),
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

  // Read on the server and handed down as a prop. The public half is safe to
  // publish, but routing it through here keeps every WEB_PUSH_ value out of the
  // client bundle and leaves one place that decides whether push exists at all.
  return (
    <ResultView initial={result} token={token} pushPublicKey={getWebPushPublicKey()} />
  );
}
