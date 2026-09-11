"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/customer/Wordmark";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { BrandTagline, ScriptNote, SkylineFooter } from "@/components/customer/Motifs";
import { rememberLastOrder } from "@/lib/utils/last-order";
import { normaliseReference } from "@/lib/utils/reference";

/**
 * Finding an order again, on a phone that does not remember it.
 *
 * Two fields, and both are needed. The reference is six characters so that it
 * can be read down a phone, which is exactly why it cannot be the only thing
 * asked for: the contact the result was going to is what makes this safe. A
 * customer who has both has already been sent the result once.
 *
 * Every kind of miss gets the same message. Saying "no such reference" would
 * tell someone working through codes which ones exist.
 */
export function FindOrder() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/result/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, contact }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { resultPath?: string; error?: string }
        | null;

      if (!response.ok || !payload?.resultPath) {
        setError(payload?.error ?? "We couldn't find that order. Please try again.");
        return;
      }

      rememberLastOrder(normaliseReference(reference), payload.resultPath);
      router.replace(payload.resultPath);
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const field =
    "min-h-14 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-start justify-between gap-3 pt-5">
        <Link
          href="/compare"
          className="-ml-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-900 hover:bg-ink-100"
          aria-label="Back"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
        </Link>
        <Wordmark size="sm" />
        <ScriptNote underline className="ml-auto text-[0.9rem] text-slate-600">
          Same Food
          <br />
          Lower Prices
        </ScriptNote>
      </header>

      <div className="relative mt-4">
        <div className="relative z-10 max-w-[62%]">
          <h1 className="text-[1.85rem] font-extrabold leading-tight text-ink-900">
            Find your order
          </h1>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
            Enter the reference we gave you and where we were sending the result.
          </p>
        </div>
        <FoodPhoto
          name="receipt"
          eager
          className="pointer-events-none absolute -top-2 right-0 w-[32%] select-none"
        />
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="reference" className="mb-2 block text-[0.95rem] font-bold text-ink-900">
            Reference
          </label>
          <input
            id="reference"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            value={reference}
            onChange={(event) => setReference(event.target.value.toUpperCase())}
            placeholder="K7M2QX"
            className={`${field} tracking-[0.2em] tabular-nums`}
          />
        </div>

        <div>
          <label htmlFor="contact" className="mb-2 block text-[0.95rem] font-bold text-ink-900">
            WhatsApp number or email
          </label>
          <input
            id="contact"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="50 123 4567"
            className={field}
          />
          <p className="mt-2 text-sm text-ink-600">
            The one you gave us when you sent the order.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-rose-50 p-3.5 text-sm font-semibold text-rose-800 ring-1 ring-rose-200"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <Button onClick={() => void submit()} loading={pending} loadingLabel="Looking…" arrow>
          Find my order
        </Button>

        <p className="text-center text-[0.85rem] text-slate-500">
          Lost the reference?{" "}
          <Link href="/compare" className="font-bold text-ink-800 underline underline-offset-2">
            Send us the order again
          </Link>
        </p>
      </div>

      <footer className="relative mt-auto border-t border-ink-100 pt-4">
        <SkylineFooter className="absolute inset-x-0 bottom-0 -z-10" />
        <div className="flex items-end justify-end gap-4 pb-4">
          <BrandTagline />
        </div>
      </footer>
    </div>
  );
}
