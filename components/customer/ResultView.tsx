"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Loader2, UtensilsCrossed } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import { formatDecimalStringAsCurrency } from "@/lib/calculations/money";
import { CopyReference } from "@/components/customer/CopyReference";
import { Disclaimer } from "@/components/customer/Disclaimer";
import { TickBadge } from "@/components/customer/FoodArt";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { BrandTagline, ScriptBubble, ScriptNote, SkylineFooter, Sparks } from "@/components/customer/Motifs";
import { Wordmark } from "@/components/customer/Wordmark";
import { track } from "@/lib/analytics/track";
import type { PublicResult } from "@/lib/submissions/result";

/**
 * The customer's result.
 *
 * Rendered from the server on first paint, then kept live: while the answer is
 * still being worked out this page asks for it again every few seconds, so a
 * customer who stays on the screen watches "checking" turn into their saving
 * without touching anything. One who leaves gets the same page as a link over
 * WhatsApp. It is the same screen either way, which is what lets the wait be
 * invisible when we happen to be quick.
 */

/** Steps out as the wait lengthens: quick while it is plausibly imminent. */
function pollDelay(elapsedMs: number): number {
  if (elapsedMs < 2 * 60_000) return 5_000;
  if (elapsedMs < 10 * 60_000) return 15_000;
  return 30_000;
}

/** After this, a forgotten tab stops asking. A refresh starts it again. */
const GIVE_UP_AFTER_MS = 30 * 60_000;

export function ResultView({ initial, token }: { initial: PublicResult; token: string }) {
  const [result, setResult] = useState(initial);

  // Counted against the submission, not the visit: this page is usually opened
  // from a message, hours later, on a browser that has never seen the wizard.
  useEffect(() => {
    track("result_viewed", token);
  }, [token]);
  // Set on the first tick rather than during render: reading the clock while
  // rendering makes the component's output depend on when React happened to
  // call it.
  const startedAt = useRef(0);
  const [stalled, setStalled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/result/${token}`, { cache: "no-store" });
      if (!response.ok) return;
      setResult((await response.json()) as PublicResult);
    } catch {
      // Offline, asleep, or a flaky connection. The next tick tries again.
    }
  }, [token]);

  useEffect(() => {
    if (result.state !== "checking") return;
    if (startedAt.current === 0) startedAt.current = Date.now();

    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const elapsed = Date.now() - startedAt.current;
      if (elapsed > GIVE_UP_AFTER_MS) {
        setStalled(true);
        return;
      }
      timer = setTimeout(() => {
        // A background tab is not watching, so it does not need to ask.
        if (document.visibilityState === "visible") void refresh();
        tick();
      }, pollDelay(elapsed));
    };
    tick();

    // Coming back to the tab is the strongest hint that someone wants to know.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [result.state, refresh]);

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

      {result.state === "checking" ? (
        <Checking reference={result.referenceNumber} stalled={stalled} onRetry={() => void refresh()} />
      ) : null}
      {result.state === "saving" ? <Saving result={result} token={token} /> : null}
      {result.state === "no_saving" ? <NoSaving result={result} /> : null}
      {result.state === "unavailable" ? <Unavailable result={result} /> : null}
      {result.state === "cancelled" ? <Cancelled reference={result.referenceNumber} /> : null}

      <footer className="relative mt-auto border-t border-ink-100 pt-4">
        <SkylineFooter className="absolute inset-x-0 bottom-0 -z-10" />
        <div className="flex items-end justify-between gap-4 pb-4">
          <div className="max-w-[62%]">
            <Disclaimer />
            <p className="mt-2 text-xs">
              <Link
                href="/privacy"
                className="text-slate-500 underline underline-offset-2 hover:text-ink-800"
              >
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

function Checking({
  reference,
  stalled,
  onRetry,
}: {
  reference: string;
  stalled: boolean;
  onRetry: () => void;
}) {
  return (
    <>
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
        <TickBadge className="absolute left-1/2 top-0 z-10 h-24 w-24 -translate-x-1/2 drop-shadow-lg" />
        <ScriptBubble className="absolute left-0 top-[38%] text-[0.72rem]">
          We&apos;ll
          <br />
          compare
          <br />
          for you
        </ScriptBubble>
      </div>

      <p className="mt-4 text-[0.82rem] font-bold uppercase tracking-[0.16em] text-slate-500">
        Price check received
      </p>
      <h1 className="relative mt-1 inline-flex items-start text-[2rem] font-extrabold leading-[1.12] text-ink-900">
        We&apos;re checking your order
        <Sparks className="ml-1 h-5 w-5 shrink-0" />
      </h1>

      <p
        aria-live="polite"
        className="mt-3 flex items-center gap-2.5 rounded-2xl bg-brand-100 px-3.5 py-3 text-sm font-semibold text-ink-800"
      >
        {stalled ? (
          <>
            <span className="flex-1">
              Still with us — we&apos;ll message you the moment it&apos;s ready.
            </span>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-9 shrink-0 rounded-full bg-white px-3.5 text-sm font-bold text-ink-900 ring-1 ring-ink-200"
            >
              Check now
            </button>
          </>
        ) : (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
            {/* What we are doing, not how. "Rebuilding your basket" sounded
                like we were changing their order. */}
            <span>Checking the price for you — hang tight…</span>
          </>
        )}
      </p>

      <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-600">
        Keep this page open and your result appears here. You can also close it — we&apos;ll send
        you this same link. Nothing has been ordered.
      </p>

      <div className="mt-5 flex items-center gap-3 rounded-3xl bg-cream px-4 py-4 ring-1 ring-sand">
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-slate-500">
            Reference
          </p>
          <p className="mt-1 truncate text-[1.5rem] font-extrabold tracking-tight text-ink-900">
            {reference}
          </p>
        </div>
        <CopyReference reference={reference} />
      </div>

      <div className="mt-5 mb-6">
        <Link
          href="/compare"
          className="relative inline-flex min-h-14 w-full items-center justify-center rounded-full border-2 border-ink-200 px-6 text-base font-bold text-ink-900 hover:bg-ink-50"
        >
          Check another order
          <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5" />
        </Link>
      </div>
    </>
  );
}

/** The two prices, side by side. The whole product in one block. */
function PriceRows({ result }: { result: PublicResult }) {
  return (
    <dl className="mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-ink-100">
      <div className="flex items-baseline justify-between gap-3 px-4 py-3.5">
        <dt className="text-[0.95rem] text-slate-600">Your order</dt>
        <dd className="text-[1.15rem] font-bold tabular-nums text-slate-600 line-through decoration-slate-400">
          {formatDecimalStringAsCurrency(result.currentTotal)}
        </dd>
      </div>
      <div className="border-t border-ink-100" />
      <div className="flex items-baseline justify-between gap-3 bg-chip-green-bg px-4 py-3.5">
        <dt className="text-[0.95rem] font-bold text-chip-green-fg">{result.comparisonApp}</dt>
        <dd className="text-[1.35rem] font-extrabold tabular-nums text-chip-green-fg">
          {formatDecimalStringAsCurrency(result.comparisonTotal)}
        </dd>
      </div>
    </dl>
  );
}

function Saving({ result, token }: { result: PublicResult; token: string }) {
  const saving = formatDecimalStringAsCurrency(result.savingAmount);

  return (
    <>
      <p className="mt-5 text-[0.82rem] font-bold uppercase tracking-[0.16em] text-slate-500">
        Your result
      </p>

      {/* The number they came for. */}
      <section className="relative mt-2 overflow-hidden rounded-3xl bg-linear-to-br from-brand-100 to-brand-200 px-4 py-5">
        <div className="relative z-10 max-w-[62%]">
          <p className="text-[1.05rem] font-bold text-ink-800">You could save</p>
          <p className="mt-0.5 text-[2.9rem] font-extrabold leading-none tracking-tight text-ink-900">
            {saving}
          </p>
          {result.savingPercentage !== null ? (
            <p className="mt-2 inline-block rounded-full bg-white/80 px-3 py-1 text-[0.85rem] font-extrabold text-ink-900">
              {result.savingPercentage}% less on {result.comparisonApp}
            </p>
          ) : null}
        </div>
        <FoodPhoto
          name="bagCluster"
          eager
          className="pointer-events-none absolute -bottom-2 -right-3 w-[42%] select-none"
        />
        <ScriptBubble className="absolute right-2 top-2 z-10 text-[0.66rem] leading-tight">
          Nice
          <br />
          one!
        </ScriptBubble>
      </section>

      <PriceRows result={result} />

      {result.restaurantName ? (
        <p className="mt-3 text-[0.9rem] leading-relaxed text-slate-600">
          Same basket at <span className="font-bold text-ink-900">{result.restaurantName}</span>,
          delivered to the same area, including fees.
        </p>
      ) : null}

      {result.items.length > 0 ? (
        <section className="mt-4">
          <h2 className="text-[0.95rem] font-extrabold text-ink-900">What to add</h2>
          <ul className="mt-2 divide-y divide-ink-100 rounded-2xl bg-ink-50 px-3.5">
            {result.items.map((item, index) => (
              <li key={`${index}-${item.name}`} className="flex items-start gap-3 py-2.5">
                <UtensilsCrossed aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                {/* Wrapped, not truncated: this is the list being retyped into
                    another app, so the end of a name is the useful part. */}
                <span className="min-w-0 flex-1 text-[0.92rem] font-semibold leading-snug text-ink-900">
                  {item.name}
                </span>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[0.78rem] font-bold tabular-nums text-slate-600 ring-1 ring-ink-200">
                  &times;{item.quantity}
                </span>
                {item.linePrice ? (
                  <span className="shrink-0 text-[0.88rem] font-extrabold tabular-nums text-ink-900">
                    {CURRENCY} {item.linePrice}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.comparisonUrl ? (
        <div className="mt-5">
          <a
            href={result.comparisonUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("keeta_opened", token)}
            className="relative inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-400 px-6 text-base font-bold text-ink-900 shadow-sm hover:bg-brand-300"
          >
            Open on {result.comparisonApp}
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
          {/* Said plainly rather than discovered at the till. */}
          <p className="mt-2 text-center text-[0.85rem] text-slate-500">
            Opens {result.comparisonApp} at the restaurant — you&apos;ll add the items yourself.
          </p>
        </div>
      ) : null}

      <p className="mt-4 mb-6 rounded-2xl bg-flame-50 p-3.5 text-[0.85rem] leading-relaxed text-ink-600">
        Prices and promotions change. Check the final amount in the app before you order — this
        was the price when we looked.
      </p>
    </>
  );
}

function NoSaving({ result }: { result: PublicResult }) {
  return (
    <>
      <p className="mt-5 text-[0.82rem] font-bold uppercase tracking-[0.16em] text-slate-500">
        Your result
      </p>
      <h1 className="mt-1 text-[1.9rem] font-extrabold leading-tight text-ink-900">
        You&apos;re already on the better price
      </h1>
      <p className="mt-2 text-[1rem] leading-relaxed text-slate-600">
        We rebuilt the same basket on {result.comparisonApp} and it didn&apos;t come out cheaper
        this time. Go ahead and order where you were.
      </p>

      {result.comparisonTotal ? <PriceRows result={result} /> : null}

      <div className="mt-5 mb-6">
        <Link
          href="/compare"
          className="relative inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-400 px-6 text-base font-bold text-ink-900 shadow-sm hover:bg-brand-300"
        >
          Check another order
          <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5" />
        </Link>
      </div>
    </>
  );
}

/**
 * The basket nobody could price.
 *
 * Not a failure screen and not an apology: the comparison app simply does not
 * carry this restaurant, which is a fact about the world rather than about the
 * customer's order. So it says that plainly, names the restaurant when we know
 * it, invents no numbers, and offers the only useful next step.
 */
function Unavailable({ result }: { result: PublicResult }) {
  const restaurant = result.restaurantName?.trim();

  return (
    <>
      <div className="relative mt-3 h-40">
        <div
          aria-hidden="true"
          className="absolute inset-x-2 bottom-2 top-4 rounded-[2.5rem] bg-linear-to-b from-brand-100 to-beige"
        />
        <FoodPhoto
          name="bowl"
          eager
          className="pointer-events-none absolute bottom-0 right-4 w-[46%] select-none"
        />
        <ScriptNote className="absolute left-5 top-1/2 -translate-y-1/2 text-[0.95rem] text-ink-900">
          Not on
          <br />
          {result.comparisonApp}
          <br />
          yet
        </ScriptNote>
      </div>

      <p className="mt-4 text-[0.82rem] font-bold uppercase tracking-[0.16em] text-slate-500">
        Your result
      </p>
      <h1 className="mt-1 text-[1.9rem] font-extrabold leading-tight text-ink-900">
        We couldn&apos;t compare this one
      </h1>
      <p className="mt-2.5 text-[1rem] leading-relaxed text-slate-600">
        {result.unavailableReason === "items_not_available" && restaurant ? (
          <>
            <span className="font-bold text-ink-900">{restaurant}</span> is on{" "}
            {result.comparisonApp}, but we couldn&apos;t rebuild this exact basket there — some of
            your items aren&apos;t on its menu.
          </>
        ) : restaurant ? (
          <>
            <span className="font-bold text-ink-900">{restaurant}</span> isn&apos;t on{" "}
            {result.comparisonApp} yet, so there&apos;s no price for us to compare against.
          </>
        ) : (
          <>
            We couldn&apos;t rebuild your order on {result.comparisonApp}, so there&apos;s no price
            for us to compare against.
          </>
        )}
      </p>
      <p className="mt-3 text-[1rem] leading-relaxed text-slate-600">
        Nothing to change then — go ahead and order where you were. Plenty of restaurants are on
        both, so it&apos;s worth sending us the next one.
      </p>

      <div className="mt-5 mb-6">
        <Link
          href="/compare"
          className="relative inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-400 px-6 text-base font-bold text-ink-900 shadow-sm hover:bg-brand-300"
        >
          Check another order
          <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5" />
        </Link>
      </div>
    </>
  );
}

function Cancelled({ reference }: { reference: string }) {
  return (
    <>
      <h1 className="mt-6 text-[1.9rem] font-extrabold leading-tight text-ink-900">
        This price check was closed
      </h1>
      <p className="mt-2 text-[1rem] leading-relaxed text-slate-600">
        We couldn&apos;t complete {reference}. Nothing was ordered, and you&apos;re welcome to send
        us another order any time.
      </p>
      <div className="mt-5 mb-6">
        <Link
          href="/compare"
          className="relative inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-400 px-6 text-base font-bold text-ink-900 shadow-sm hover:bg-brand-300"
        >
          Check another order
          <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5" />
        </Link>
      </div>
    </>
  );
}
