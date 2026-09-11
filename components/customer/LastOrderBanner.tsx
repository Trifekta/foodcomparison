"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { readLastOrder } from "@/lib/utils/last-order";

/**
 * A way back to the order this browser already sent.
 *
 * Most people who return are on the same phone that sent the order, so the
 * useful version of "enter your reference number" is not to ask for it at all.
 * The slim line only appears when there is something to go back to, and it says
 * which - a result waiting is a very different message from one still being
 * worked out.
 *
 * Typing a reference is the fallback underneath, for a different phone or a
 * browser that forgot.
 */
export function LastOrderBanner() {
  const [order, setOrder] = useState<{ reference: string; path: string } | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    // After mount, deliberately: localStorage does not exist while this renders
    // on the server, so there is nothing to read until the browser has it. It
    // runs once, and what it reads came from the last visit, not this render.
    const last = readLastOrder();
    if (!last) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setOrder(last);

    // Which of the two things to say. A failure just leaves it unsaid.
    const token = last.path.split("/").pop();
    void fetch(`/api/result/${token}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { state?: string } | null) => {
        if (result?.state) setReady(result.state !== "checking");
      })
      .catch(() => {});
  }, []);

  if (!order) {
    return (
      <p className="mt-3 text-center text-[0.85rem] text-slate-500">
        Sent us an order already?{" "}
        <Link href="/find" className="font-bold text-ink-800 underline underline-offset-2">
          Find it with your reference
        </Link>
      </p>
    );
  }

  return (
    <Link
      href={order.path}
      className="mt-3 flex items-center gap-3 rounded-2xl bg-chip-green-bg px-3.5 py-3 text-chip-green-fg hover:brightness-95"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-extrabold leading-tight">
          {ready === true ? "Your result is ready" : "We're still checking your order"}
        </span>
        <span className="block text-[0.82rem] tabular-nums opacity-80">{order.reference}</span>
      </span>
      {ready === null ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin opacity-70" />
      ) : (
        <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" />
      )}
    </Link>
  );
}
