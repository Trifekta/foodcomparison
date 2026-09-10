"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Camera, Check, Loader2, Maximize2, RefreshCw, Trash2 } from "lucide-react";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/constants";
import { validateImageClientSide } from "@/lib/validation/submission";
import { downscaleImage } from "@/lib/utils/image-client";
import { FieldError } from "@/components/ui/FieldError";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { Sparks } from "@/components/customer/Motifs";
import { cn } from "@/lib/utils/cn";

interface ImageUploadProps {
  /** Position in the upload list, shown as a numbered badge. */
  step: number;
  label: string;
  hint?: string;
  file: File | null;
  /**
   * `file` is the downscaled version that gets uploaded. `original` is what the
   * customer actually picked - handed back because reading text off it must not
   * be done on a JPEG re-encode, which destroys small print and Arabic.
   */
  onChange: (file: File | null, original?: File | null) => void;
  error?: string | null;
  /** Drives the pill: Required is red, Optional is green, as in the designs. */
  requirement: "required" | "optional";
  allowRemove?: boolean;
  /** Which supplied render fills the empty dropzone. */
  art?: "cartDoc" | "receipt";
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
  file,
  onChange,
  error,
  requirement,
  allowRemove = false,
  art = "cartDoc",
}: ImageUploadProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // Derived from the file rather than stored; the effect only releases the URL.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const accept = async (candidate: File | undefined | null) => {
    if (!candidate) return;
    const validationError = validateImageClientSide(candidate);
    if (validationError) {
      setLocalError(validationError);
      onChange(null);
      return;
    }
    setLocalError(null);
    setProcessing(true);
    try {
      onChange(await downscaleImage(candidate), candidate);
    } finally {
      setProcessing(false);
    }
  };

  const message = error ?? localError;
  const filled = Boolean(file && previewUrl);

  return (
    <section className="rounded-3xl bg-white p-4 shadow-[0_2px_14px_rgba(23,23,28,0.05)] ring-1 ring-ink-100">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
            filled ? "bg-emerald-500 text-white" : "bg-brand-300 text-ink-900",
          )}
        >
          {filled ? <Check className="h-4 w-4" strokeWidth={3} /> : step}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <label htmlFor={inputId} className="text-[1.02rem] font-extrabold text-ink-900">
              {label}
            </label>
            {requirement === "required" ? (
              <span className="rounded-full bg-chip-red-bg px-2.5 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wide text-chip-red-fg">
                Required
              </span>
            ) : (
              <span className="rounded-full bg-chip-green-bg px-2.5 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wide text-chip-green-fg">
                Optional
              </span>
            )}
          </div>
          {hint ? <p className="mt-0.5 text-sm leading-snug text-slate-500">{hint}</p> : null}
        </div>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        aria-describedby={message ? errorId : undefined}
        aria-invalid={message ? true : undefined}
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
          className="mt-3"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void accept(event.dataTransfer.files?.[0]);
          }}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
            className={cn(
              "flex min-h-[9.5rem] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors",
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
                <span aria-hidden="true" className="relative mb-1.5 block h-[5.25rem] w-28">
                  <FoodPhoto name={art} className="absolute inset-0 h-full w-full object-contain" />
                  <span className="absolute -bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-400 shadow-sm">
                    <Camera className="h-4.5 w-4.5 text-ink-900" strokeWidth={2.2} />
                  </span>
                  <Sparks className="absolute -left-3 top-3 h-5 w-5" />
                  <Sparks className="absolute -right-2 top-1 h-5 w-5 -scale-x-100" />
                </span>
                <span className="text-[0.95rem] font-extrabold text-ink-900">Tap to upload</span>
                <span className="text-xs text-slate-400">JPG, PNG or WEBP · up to 10 MB</span>
              </>
            )}
          </button>
        </div>
      )}

      <FieldError id={errorId} message={message} />
    </section>
  );
}
