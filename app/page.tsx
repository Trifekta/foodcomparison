import Link from "next/link";
import { ChevronRight, PiggyBank, Camera, Search } from "lucide-react";
import { Wordmark } from "@/components/customer/Wordmark";
import { Disclaimer } from "@/components/customer/Disclaimer";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import {
  BrandTagline,
  ScriptNote,
  SkylineFooter,
  Sparks,
} from "@/components/customer/Motifs";
import { TrackLanding } from "@/components/customer/TrackLanding";
import { LandingActions } from "@/components/customer/LandingActions";
import { LandingFoodApps } from "@/components/customer/LandingFoodApps";
import {
  EXAMPLE_COMPARISON,
  EXAMPLE_NEEDS_REAL_DATA,
  aed,
} from "@/lib/customer/example-comparison";
import { RESULT_PROMISE } from "@/lib/constants";

const STEPS = [
  {
    icon: Camera,
    tint: "bg-brand-200 text-brand-800",
    title: "Upload your cart",
    body: "A screenshot of your food cart.",
  },
  {
    icon: Search,
    tint: "bg-chip-red-bg text-chip-red-fg",
    title: "We compare it",
    body: "The same basket on Keeta.",
  },
  {
    icon: PiggyBank,
    tint: "bg-chip-green-bg text-chip-green-fg",
    // The 5-minute promise stays in this column rather than in the trust line
    // under the buttons, where "usually under 5 minutes" read as a demand on
    // the customer's time rather than a promise about ours.
    title: "See what you save",
    body: `The difference, usually ${RESULT_PROMISE}.`,
  },
];

export default function LandingPage() {
  const { fromApp, fromTotal, toTotal, saved } = EXAMPLE_COMPARISON;

  // See EXAMPLE_COMPARISON.fromApp - a real brand's name does not go above
  // invented prices, so the column says what it is until the figures are real.
  const fromLabel = fromApp ?? "Delivery app";

  return (
    <div className="safe-bottom mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      {/* Renders nothing. It is here so the advert click is counted before the
          customer decides whether to start. */}
      <TrackLanding />

      <header className="flex items-start justify-between gap-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Wordmark size="md" />
        <ScriptNote underline className="text-[0.95rem] text-slate-600">
          Same Food
          <br />
          Lower Prices
        </ScriptNote>
      </header>

      <main className="flex flex-1 flex-col">
        {/* The promise first, the evidence under it.
            The headline sat below the banner, which meant the first thing an
            advert click read was a pair of prices for a basket they had no
            reason to care about yet. The sentence is what makes the numbers
            mean something, so it goes above them. */}
        <h1 className="relative mt-4 text-[2.1rem] font-extrabold leading-[1.12] text-ink-900">
          Before you order,
          <br />
          check if you can <span className="marker">save.</span>
          <Sparks className="ml-1 inline-block h-5 w-5 align-top" />
        </h1>

        <p className="mt-2.5 text-[1rem] leading-relaxed text-slate-600">
          Upload your cart from Talabat, Careem, Deliveroo or Noon Food. We&apos;ll check the same
          basket on Keeta.
        </p>

        {/* The proof banner.
            Every figure comes from lib/customer/example-comparison.ts, which is
            also what the example sheet reads - one basket, quoted once. Two
            surfaces disagreeing about the same order would undo exactly the
            trust this is here to build. */}
        <div className="relative mt-4 overflow-hidden rounded-3xl bg-linear-to-r from-brand-100 to-beige px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <FoodPhoto
              name="spread"
              eager
              className="pointer-events-none w-[22%] shrink-0 select-none"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="truncate text-[0.68rem] font-bold uppercase tracking-[0.06em] text-ink-500">
                  {fromLabel}
                </span>
              </div>
              <span className="block whitespace-nowrap text-[0.95rem] font-semibold tabular-nums text-slate-500 line-through decoration-slate-400">
                AED {aed(fromTotal)}
              </span>

              <div className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.06em] text-ink-500">
                Keeta
              </div>
              <span className="block whitespace-nowrap text-[1.3rem] font-extrabold tabular-nums leading-tight text-ink-900">
                AED {aed(toTotal)}
              </span>
            </div>

            <div className="shrink-0 rounded-2xl bg-chip-green-bg px-3 py-2 text-center">
              <span className="block text-[0.68rem] font-bold uppercase tracking-[0.06em] text-chip-green-fg">
                Saved
              </span>
              <span className="block whitespace-nowrap text-[1.05rem] font-extrabold tabular-nums text-chip-green-fg">
                AED {aed(saved)}
              </span>
            </div>
          </div>

          {/* What kind of claim this is. Driven by the data, so the day real
              numbers land the wording corrects itself rather than waiting for
              somebody to remember this line exists. */}
          <p className="mt-2 text-center text-[0.72rem] font-semibold text-ink-500">
            {EXAMPLE_NEEDS_REAL_DATA
              ? "Same items · Same restaurant · Example"
              : "Same items · Same restaurant · Real comparison"}
          </p>
        </div>

        {/* Both buttons and the example sheet. A client component, so that the
            page around it stays a server component - this is the first paint of
            an advert click, and the less that runs before it appears the
            better. */}
        <LandingActions />

        <p className="mt-3 text-center text-[0.92rem] font-semibold text-slate-500">
          Free · No account needed · About a minute
        </p>

        {/* Three across rather than three stacked.
            Stacked, the explainer pushed everything under it - the food-app
            card included - a full screen further down. Across, it reads as one
            short process at a glance, which is all it was ever meant to do. */}
        <ol className="mt-5 flex items-start gap-1 rounded-3xl bg-white p-3 shadow-[0_2px_12px_rgba(23,23,28,0.04)] ring-1 ring-ink-100">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex min-w-0 flex-1 items-start gap-1">
              <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                <span aria-hidden="true" className="relative shrink-0">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${step.tint}`}
                  >
                    <step.icon className="h-[1.15rem] w-[1.15rem]" />
                  </span>
                  <Sparks className="absolute -right-2 -top-1 h-3.5 w-3.5" />
                </span>
                <span className="mt-1.5 block text-[0.82rem] font-extrabold leading-tight text-ink-900">
                  {index + 1}. {step.title}
                </span>
                <span className="mt-0.5 block text-[0.72rem] leading-tight text-slate-500">
                  {step.body}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <ChevronRight
                  aria-hidden="true"
                  className="mt-3.5 h-4 w-4 shrink-0 text-slate-300"
                />
              )}
            </li>
          ))}
        </ol>

        {/* Below both calls to action, because it is for the subset who cannot
            act on them yet. */}
        <LandingFoodApps />
      </main>

      <footer className="relative mt-6 border-t border-ink-100 pt-4">
        <SkylineFooter className="absolute inset-x-0 bottom-0 -z-10" />
        <div className="flex items-end justify-between gap-4 pb-4">
          <div className="max-w-[62%]">
            <Disclaimer />
            <p className="mt-2 text-xs">
              <Link
                href="/privacy"
                className="inline-flex min-h-11 items-center px-2 text-slate-500 underline underline-offset-2 hover:text-ink-800"
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
