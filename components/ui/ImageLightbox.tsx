"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ImageLightboxProps {
  src: string | null;
  alt: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Full-size view of a screenshot the customer uploaded.
 *
 * The previews elsewhere are cropped to the top of the image, which is the
 * useful slice but hides the one mistake worth catching: a screenshot that cut
 * off half the order. This is how someone checks the whole thing.
 *
 * Built on <dialog> rather than a div, which brings Escape-to-close, focus
 * trapping and inertness of the page behind it without writing any of it.
 */
export function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!src) return null;

  return (
    <dialog
      ref={ref}
      // Fires for Escape and the backdrop alike, so state stays in step with
      // the element however it was dismissed.
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop closes; clicking the image does not.
        if (event.target === ref.current) onClose();
      }}
      aria-label={alt}
      className="max-h-dvh max-w-full bg-transparent p-0 backdrop:bg-black/80 open:flex open:items-center open:justify-center"
    >
      <div className="relative max-h-dvh overflow-auto p-4">
        {/* A local object URL, so the Next image optimiser does not apply. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="mx-auto block h-auto w-auto max-w-full rounded-xl" />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-lg hover:bg-white"
      >
        <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </dialog>
  );
}
