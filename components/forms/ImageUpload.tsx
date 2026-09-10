"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/constants";
import { validateImageClientSide } from "@/lib/validation/submission";
import { downscaleImage } from "@/lib/utils/image-client";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils/cn";

interface ImageUploadProps {
  /** Position in the upload list, shown as a numbered badge. */
  step?: number;
  label: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string | null;
  optional?: boolean;
  allowRemove?: boolean;
}

/**
 * One numbered upload slot.
 *
 * Shows its own state - Optional, Uploaded, or waiting - so a customer can see
 * at a glance what is still needed and what is genuinely their choice.
 */
export function ImageUpload({
  step,
  label,
  hint,
  file,
  onChange,
  error,
  optional = false,
  allowRemove = false,
}: ImageUploadProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);

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
      onChange(await downscaleImage(candidate));
    } finally {
      setProcessing(false);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void accept(event.dataTransfer.files?.[0]);
  };

  const message = error ?? localError;

  return (
    <div className="rounded-3xl bg-ink-50 p-3.5">
      <div className="flex items-start gap-3 px-1 pb-3 pt-1">
        {step ? (
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-ink-900 ring-1 ring-ink-200"
          >
            {step}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="block text-[0.95rem] font-bold text-ink-900">
            {label}
          </label>
          {hint ? <p className="mt-0.5 text-sm text-ink-500">{hint}</p> : null}
        </div>

        {file ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            Uploaded
          </span>
        ) : optional ? (
          <span className="shrink-0 rounded-full bg-ink-200/80 px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-wide text-ink-500">
            Optional
          </span>
        ) : null}
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

      {previewUrl && file ? (
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
          {/*
            Cropped to the top of the screenshot, which is where the restaurant
            and items sit. Tapping "Change" is the way to review it in full, and
            the admin always sees the whole image.
          */}
          {/* Local object URL: the Next image optimiser does not apply. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`Preview of your ${label.toLowerCase()}`}
            className="h-40 w-full bg-ink-50 object-cover object-top"
          />
          <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-2 py-1.5">
            <div className="flex gap-1.5">
              {allowRemove ? (
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-600 hover:bg-ink-100"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  Remove
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-600 hover:bg-ink-100"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                Change
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
            className={cn(
              "flex min-h-36 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed bg-white px-4 py-7 text-center transition-colors",
              dragging ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-400",
            )}
          >
            {processing ? (
              <>
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-ink-400" />
                <span className="text-sm font-bold text-ink-700">Preparing your image…</span>
              </>
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-brand-100"
                >
                  <ImagePlus className="h-5 w-5 text-brand-700" />
                </span>
                <span className="text-sm font-bold text-ink-900">Tap to upload</span>
                <span className="text-xs text-ink-400">JPG, PNG or WEBP · up to 10 MB</span>
              </>
            )}
          </button>
        </div>
      )}

      <FieldError id={errorId} message={message} />
    </div>
  );
}
