import Link from "next/link";
import { ArrowRight, Camera, ChevronRight, PiggyBank, Search } from "lucide-react";
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
import { RESULT_PROMISE } from "@/lib/constants";

const STEPS = [
  {
    icon: Camera,
    tint: "bg-brand-200 text-brand-800",
    title: "Upload your cart",
    // Deliberately not "one screenshot" again - the line under the button
    // already says that, and this is the place to answer the question it
    // leaves behind: which screen?
    body: "The screen with your items and total.",
  },
  {
    icon: Search,
    tint: "bg-chip-red-bg text-chip-red-fg",
    title: "We compare it",
    body: "We check the same basket on Keeta.",
  },
  {
    icon: PiggyBank,
    tint: "bg-chip-green-bg text-chip-green-fg",
    title: "See what you could save",
    // The 5-minute promise lives here now, not in the trust line under the
    // button, where "usually under 5 minutes" read as a demand on their time
    // rather than a promise about ours.
    body: `We message you the difference, usually ${RESULT_PROMISE}.`,
  },
];

export default function LandingPage() {
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
        {/* Hero banner */}
        {/* MOCKUP - numbers must come from a real comparison before shipping. */}
        <div className="relative mt-3 overflow-hidden rounded-3xl bg-linear-to-r from-brand-100 to-beige px-4 py-3.5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ink-500">
            A real order we checked
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="w-[4.2rem] shrink-0 text-[0.82rem] text-slate-500">Talabat</span>
                <span className="whitespace-nowrap text-[1rem] font-semibold tabular-nums text-slate-500 line-through decoration-slate-400">
                  AED 82.00
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="w-[4.2rem] shrink-0 text-[0.82rem] font-semibold text-ink-900">
                  Keeta
                </span>
                <span className="whitespace-nowrap text-[1.45rem] font-extrabold tabular-nums leading-tight text-ink-900">
                  AED 68.00
                </span>
              </div>
              <p className="mt-2 inline-block rounded-full bg-chip-green-bg px-3 py-1 text-[0.85rem] font-extrabold text-chip-green-fg">
                Saved AED 14.00
              </p>
            </div>

            <FoodPhoto
              name="spread"
              eager
              className="pointer-events-none w-[38%] shrink-0 select-none"
            />
          </div>
        </div>

        <h1 className="relative mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink-900">
          Before you order,
          <br />
          check if you can <span className="marker">save.</span>
          <Sparks className="ml-1 inline-block h-5 w-5 align-top" />
        </h1>

        <p className="mt-3 text-[1.02rem] leading-relaxed text-slate-600">
          Upload your cart from Talabat, Careem, Deliveroo or Noon Food. We&apos;ll check the same
          basket on Keeta.
        </p>

        <Link
          href="/compare"
          className="relative mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-400 px-6 text-base font-bold text-ink-900 shadow-sm transition-colors hover:bg-brand-300 active:bg-brand-500"
        >
          Get started
          <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5" />
        </Link>

        <p className="mt-3 text-center text-[0.95rem] font-semibold text-slate-500">
          Free · No account needed · One screenshot, about a minute
        </p>

        <ol className="mt-5 space-y-2.5">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex items-center gap-3.5 rounded-3xl bg-white p-3.5 shadow-[0_2px_12px_rgba(23,23,28,0.04)] ring-1 ring-ink-100"
            >
              <span aria-hidden="true" className="relative shrink-0">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${step.tint}`}
                >
                  <step.icon className="h-5 w-5" />
                </span>
                <Sparks className="absolute -right-2.5 -top-1 h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.02rem] font-extrabold text-ink-900">
                  {index + 1}. {step.title}
                </span>
                <span className="mt-0.5 block text-[0.88rem] text-slate-500">{step.body}</span>
              </span>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-300" />
            </li>
          ))}
        </ol>
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
