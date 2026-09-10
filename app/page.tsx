import Link from "next/link";
import { ArrowRight, Camera, ChevronRight, PiggyBank, Search } from "lucide-react";
import { Wordmark } from "@/components/customer/Wordmark";
import { Disclaimer } from "@/components/customer/Disclaimer";
import { FoodSpread } from "@/components/customer/FoodArt";
import {
  BrandTagline,
  ScriptBubble,
  ScriptNote,
  SkylineFooter,
  Sparks,
} from "@/components/customer/Motifs";

const STEPS = [
  {
    icon: Camera,
    tint: "bg-brand-200 text-brand-800",
    title: "Upload your cart",
    body: "One screenshot is all we need.",
  },
  {
    icon: Search,
    tint: "bg-chip-red-bg text-chip-red-fg",
    title: "We compare it",
    body: "We rebuild the same basket on another app.",
  },
  {
    icon: PiggyBank,
    tint: "bg-chip-green-bg text-chip-green-fg",
    title: "See what you could save",
    body: "We send you the difference.",
  },
];

export default function LandingPage() {
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

      <main className="flex flex-1 flex-col">
        {/* Hero banner */}
        <div className="relative mt-3 overflow-hidden rounded-3xl bg-linear-to-r from-brand-100 to-beige px-4 py-4">
          <div className="relative z-10 max-w-[52%]">
            <ScriptNote className="text-[1.35rem] text-ink-900">
              Good Food
              <br />
              Smarter Choices
            </ScriptNote>
            <p className="mt-2 text-[0.85rem] font-semibold leading-snug text-slate-600">
              Same great food.
              <br />A better deal.
            </p>
            <span aria-hidden="true" className="mt-1.5 block h-[3px] w-14 rounded-full bg-brand-400" />
          </div>
          <FoodSpread className="absolute inset-y-0 right-0 w-[60%]" />
          <ScriptBubble className="absolute right-3 top-3 z-10 text-[0.72rem]">
            Save
            <br />
            more
          </ScriptBubble>
        </div>

        <h1 className="relative mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink-900">
          Before you order,
          <br />
          check if you can <span className="marker">save.</span>
          <Sparks className="ml-1 inline-block h-5 w-5 align-top" />
        </h1>

        <p className="mt-3 text-[1.02rem] leading-relaxed text-slate-600">
          Upload your food cart and we&apos;ll check whether the same order may cost less on
          another delivery app.
        </p>

        <Link
          href="/compare"
          className="relative mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-400 px-6 text-base font-bold text-ink-900 shadow-sm transition-colors hover:bg-brand-300 active:bg-brand-500"
        >
          Check my order
          <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5" />
        </Link>

        <p className="mt-3 text-center text-[0.95rem] font-semibold text-slate-500">
          Free to check · No account needed
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
