"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useObjectUrl } from "@/lib/customer/use-object-url";
import { Camera, Check, Loader2, Maximize2, RefreshCw, Trash2 } from "lucide-react";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/constants";
import { validateImageClientSide } from "@/lib/validation/submission";
import { downscaleImage } from "@/lib/utils/image-client";
import { FieldError } from "@/components/ui/FieldError";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { Sparks } from "@/components/customer/Motifs";
import {
  ScreenshotExampleButton,
  type ScreenshotExample,
} from "@/components/customer/ScreenshotExample";
import { cn } from "@/lib/utils/cn";

interface ImageUploadProps {
  /** Position in the upload list, shown as a numbered badge. */
  step: number;
  label: string;
  hint?: string;
  /**
   * One quiet line under the box, saying what the screenshot needs to show.
   *
   * Deliberately below rather than above: it is the last thing read before the
   * camera opens, which is the moment it can still change what gets taken.
   * Kept to a single sentence in secondary text - a screen that lectures people
   * about screenshots costs more uploads than a bad screenshot does.
   */
  helper?: string;
  file: File | null;
  /**
   * `file` is the downscaled version that gets uploaded. `original` is what the
   * customer actually picked - handed back because reading text off it must not
   * be done on a JPEG re-encode, which destroys small print and Arabic.
   */
  onChange: (file: File | null, original?: File | null) => void;
  /**
   * Fires the moment a valid file is chosen, before downscaling starts.
   *
   * The extraction read wants the original bytes anyway - onChange's own
   * `original` argument - so it has no reason to wait for downscaleImage to
   * finish resizing and re-encoding a copy it will never use. Downscaling a
   * multi-megabyte phone screenshot is real canvas work, and stacking it in
   * front of a network call the customer is already waiting on is latency
   * with no payoff. This lets the caller start that call immediately, in
   * parallel with the downscale rather than after it.
   */
  onFilePicked?: (file: File) => void;
  /** First-screen cart slot: show the picker itself without the numbered card. */
  direct?: boolean;
  onOpenPicker?: () => void;
  error?: string | null;
  /**
   * Drives the pill. Required is red and Optional green, as in the designs;
   * Recommended is amber, and is deliberately neither - the checkout shot is
   * not demanded, and calling it optional undersold it to the point that people
   * skipped the one screen the final total actually lives on.
   */
  requirement: "required" | "optional" | "recommended";
  allowRemove?: boolean;
  /** Which supplied render fills the empty dropzone. */
  art?: "cartDoc" | "receipt";
  /** Adds an (i) beside the label, opening a drawing of a good screenshot. */
  example?: ScreenshotExample;
  /**
   * A visual nudge, independent of the pill. Draws the eye to a slot that is
   * still empty and now known to matter, without touching what the pill says -
   * the wording stays Recommended, because it still is one: nothing here ever
   * gates Continue, and dressing the slot up as Required in a second color
   * would say otherwise. Ignored once the slot is filled.
   */
  emphasize?: boolean;
}

/**
 * One numbered upload slot.
 *
 * Each slot states whether it is required or optional and shows its own filled
 * state, so a customer can see at a glance what is still needed. The preview is
 * their real screenshot; the illustration appears only in the empty state,
 * where it cannot be mistaken for something we read out of their image.
 */
export function ImageUpload({
  step,
  label,
  hint,
  helper,
  file,
  onChange,
  onFilePicked,
  direct = false,
  onOpenPicker,
  error,
  requirement,
  allowRemove = false,
  art = "cartDoc",
  example,
  emphasize: emphasizeProp = false,
}: ImageUploadProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const previewUrl = useObjectUrl(file);

  const accept = async (candidate: File | undefined | null) => {
    if (!candidate) return;
    const validationError = validateImageClientSide(candidate);
    if (validationError) {
      setLocalError(validationError);
      onChange(null);
      return;
    }
    setLocalError(null);
    // Before the downscale, not after: the read wants exactly this file, and
    // has no reason to sit behind canvas work whose output it never sees.
    onFilePicked?.(candidate);
    setProcessing(true);
    try {
      onChange(await downscaleImage(candidate), candidate);
    } finally {
      setProcessing(false);
    }
  };

  const message = error ?? localError;
  const filled = Boolean(file);
  const simple = direct && !filled;
  const UploadControl = simple ? "label" : "button";
  // Earned attention, not decoration - only while the caller has flagged it
  // and the slot is still empty. The moment it is filled, the point is made.
  // Drives the ring and pulse below, and also the hint and helper text color -
  // the copy is what actually explains why, and a ring nobody reads past
  // would be emphasis on the wrong half of the card.
  const emphasize = emphasizeProp && !filled;

  return (
    <section
      className={cn(
        "rounded-3xl bg-white shadow-[0_2px_14px_rgba(23,23,28,0.05)] ring-1 transition-shadow",
        simple ? "p-2" : "p-4",
        emphasize ? "ring-2 ring-flame-300 shadow-[0_2px_18px_rgba(245,109,24,0.18)]" : "ring-ink-100",
      )}
    >
      {!simple ? <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
            filled ? "bg-emerald-500 text-white" : "bg-brand-300 text-ink-900",
          )}
        >
          {filled ? <Check className="h-4 w-4" strokeWidth={3} /> : step}
          {/* A small pulse, not the whole card - draws the eye without
              nagging. Gone the instant a file lands, same as the ring. */}
          {emphasize ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-flame-500" />
            </span>
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <label htmlFor={inputId} className="text-[1.02rem] font-extrabold text-ink-900">
              {label}
            </label>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wide",
                requirement === "required" && "bg-chip-red-bg text-chip-red-fg",
                requirement === "recommended" && "bg-chip-amber-bg text-chip-amber-fg",
                requirement === "optional" && "bg-chip-green-bg text-chip-green-fg",
              )}
            >
              {requirement === "required"
                ? "Required"
                : requirement === "recommended"
                  ? "Recommended"
                  : "Optional"}
            </span>
          </div>
          {hint ? (
            <p
              className={cn(
                "mt-0.5 text-sm leading-snug",
                emphasize ? "font-bold text-flame-600" : "text-slate-500",
              )}
            >
              {hint}
            </p>
          ) : null}
        </div>

        {/* At the trailing edge rather than inline after the pill: "Recommended"
            is wide enough that an inline icon wrapped onto its own line and sat
            there orphaned under the label. */}
        {example ? <ScreenshotExampleButton example={example} forLabel={label} /> : null}
      </div> : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        aria-label={simple ? label : undefined}
        aria-describedby={message ? errorId : undefined}
        aria-invalid={message ? true : undefined}
        disabled={processing}
        onClick={simple ? onOpenPicker : undefined}
        onChange={(event) => {
          void accept(event.target.files?.[0]);
          // Allow re-selecting the same file after a validation failure.
          event.target.value = "";
        }}
      />

      {filled ? (
        <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-ink-100">
          {/*
            Cropped to the top of the screenshot, where the restaurant and items
            sit. Tapping opens the whole thing, which is the only way to catch a
            screenshot that cut off the bottom of the order.
          */}
          {previewUrl ? (
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="group relative block w-full cursor-zoom-in"
              aria-label={`View your ${label.toLowerCase()} full size`}
            >
              {/* Local object URL: the Next image optimiser does not apply. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl ?? ""}
                alt={`Preview of your ${label.toLowerCase()}`}
                className="h-36 w-full bg-ink-50 object-cover object-top"
              />
              <span
                aria-hidden="true"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-ink-900/75 px-2.5 py-1 text-[0.7rem] font-bold text-white"
              >
                <Maximize2 className="h-3 w-3" strokeWidth={3} />
                Tap to check
              </span>
            </button>
          ) : (
            <p role="status" className="bg-ink-50 p-4 text-sm text-slate-600">
              Screenshot selected. Preview unavailable; you can still continue.
            </p>
          )}
          <div className="flex items-center justify-end gap-1.5 bg-white px-2 py-1.5">
            {allowRemove ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-slate-600 hover:bg-ink-100"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Remove
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-slate-600 hover:bg-ink-100"
            >
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
              Change
            </button>
          </div>

          <ImageLightbox
            src={previewUrl}
            alt={`Your ${label.toLowerCase()}, full size`}
            open={zoomed}
            onClose={() => setZoomed(false)}
          />
        </div>
      ) : (
        <div
          className={simple ? "" : "mt-3"}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files?.[0]) onOpenPicker?.();
            void accept(event.dataTransfer.files?.[0]);
          }}
        >
          <UploadControl
            {...(simple
              ? {
                  htmlFor: inputId,
                  role: "button" as const,
                  tabIndex: 0,
                  onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    inputRef.current?.click();
                  },
                }
              : {
                  type: "button" as const,
                  onClick: () => {
                    onOpenPicker?.();
                    inputRef.current?.click();
                  },
                  disabled: processing,
                })}
            className={cn(
              "flex min-h-[9.5rem] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors",
              simple && "min-h-[9rem] rounded-[1.35rem] max-[389px]:min-h-[8.25rem] max-[389px]:py-3",
              dragging ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-400 hover:bg-brand-50/40",
            )}
          >
            {processing ? (
              <>
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-slate-400" />
                <span className="text-sm font-bold text-ink-900">Preparing your image…</span>
              </>
            ) : (
              <>
                {simple ? (
                  <span aria-hidden="true" className="relative mb-1.5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
                    <Camera className="h-8 w-8 text-ink-900" strokeWidth={2.2} />
                    <Sparks className="absolute -right-6 -top-1 h-5 w-5" />
                  </span>
                ) : (
                  <span aria-hidden="true" className="relative mb-1.5 block h-[5.25rem] w-28">
                    <FoodPhoto name={art} className="absolute inset-0 h-full w-full object-contain" />
                    <span className="absolute -bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-400 shadow-sm">
                      <Camera className="h-4.5 w-4.5 text-ink-900" strokeWidth={2.2} />
                    </span>
                    <Sparks className="absolute -left-3 top-3 h-5 w-5" />
                    <Sparks className="absolute -right-2 top-1 h-5 w-5 -scale-x-100" />
                  </span>
                )}
                <span className="text-[0.95rem] font-extrabold text-ink-900">Tap to upload</span>
                <span className="text-xs text-slate-400">JPG, PNG or WEBP · up to 10 MB</span>
              </>
            )}
          </UploadControl>
        </div>
      )}

      {helper && !simple ? (
        <p
          className={cn(
            "mt-2 px-0.5 text-xs leading-snug",
            emphasize ? "font-semibold text-flame-600" : "text-slate-500",
          )}
        >
          {helper}
        </p>
      ) : null}

      <FieldError id={errorId} message={message} />
    </section>
  );
}
