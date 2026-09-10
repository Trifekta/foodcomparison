import Link from "next/link";
import { Camera, Search, PiggyBank } from "lucide-react";
import { BrandHeader } from "@/components/customer/BrandHeader";
import { Disclaimer } from "@/components/customer/Disclaimer";

const STEPS = [
  { icon: Camera, title: "Upload your cart", body: "One screenshot is all we need." },
  { icon: Search, title: "We compare it", body: "We rebuild the same basket on another app." },
  { icon: PiggyBank, title: "See what you could save", body: "We send you the difference." },
];

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <BrandHeader />

      <main className="flex flex-1 flex-col">
        <h1 className="mt-6 text-[2rem] font-extrabold leading-[1.15] tracking-tight text-ink-900">
          Before you order,
          <br />
          check if you can save.
        </h1>

        <p className="mt-4 text-base leading-relaxed text-ink-600">
          Upload your food cart and we&apos;ll check whether the same order may cost less on another
          delivery app.
        </p>

        <Link
          href="/compare"
          className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-xl border border-brand-500/40 bg-brand-400 px-5 text-base font-semibold text-ink-900 shadow-sm transition-colors hover:bg-brand-300 active:bg-brand-500"
        >
          Check my order
        </Link>

        <p className="mt-3 text-center text-sm font-medium text-ink-500">
          Free to check · No account needed
        </p>

        <ol className="mt-10 space-y-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex items-start gap-3.5 rounded-2xl border border-ink-200/80 bg-white p-4"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800"
              >
                <step.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  <span className="text-ink-400">{index + 1}.</span> {step.title}
                </p>
                <p className="mt-0.5 text-sm text-ink-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
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
