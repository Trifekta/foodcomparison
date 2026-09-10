"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copy-to-clipboard control on the reference card. */
export function CopyReference({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(reference);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the reference is on screen to copy by hand.
        }
      }}
      aria-label={copied ? "Reference copied" : `Copy reference ${reference}`}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-slate-600 hover:bg-ink-200"
    >
      {copied ? (
        <Check aria-hidden="true" className="h-5 w-5 text-emerald-600" strokeWidth={3} />
      ) : (
        <Copy aria-hidden="true" className="h-5 w-5" />
      )}
    </button>
  );
}
