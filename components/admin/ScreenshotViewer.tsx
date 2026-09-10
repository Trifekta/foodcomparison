"use client";

import { useEffect, useState } from "react";
import { Expand, ImageOff, X } from "lucide-react";

interface ScreenshotViewerProps {
  url: string | null;
  label: string;
  emptyMessage: string;
}

/**
 * Private screenshot with a click-to-enlarge lightbox.
 *
 * `url` is a short-lived signed URL created on the server; when the object is
 * missing (a seeded row, or a screenshot removed by retention) we say so rather
 * than showing a broken image.
 */
export function ScreenshotViewer({ url, label, emptyMessage }: ScreenshotViewerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!url) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50 p-6 text-center">
        <ImageOff aria-hidden="true" className="h-5 w-5 text-ink-400" />
        <p className="text-sm text-ink-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-xl border border-ink-200 bg-ink-50"
      >
        {/* Signed Supabase URL: not routed through the Next image optimiser. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="mx-auto max-h-[32rem] w-auto object-contain" />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-ink-900/80 px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Expand aria-hidden="true" className="h-3 w-3" />
          Enlarge
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} enlarged`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/85 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            autoFocus
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink-900 hover:bg-white"
            aria-label="Close"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
