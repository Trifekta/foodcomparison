"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/constants";
import { validateImageClientSide } from "@/lib/validation/submission";
import { downscaleImage } from "@/lib/utils/image-client";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils/cn";

interface ImageUploadProps {
  label: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string | null;
  optional?: boolean;
  /** Camera on mobile for the cart shot; gallery-first for the checkout shot. */
  allowRemove?: boolean;
}

export function ImageUpload({
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

  // Derived from the file rather than stored: the effect exists only to release
  // the object URL when the file changes or the component unmounts.
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
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold text-ink-900">
          {label}
        </label>
        {optional ? (
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-500">
            Optional
          </span>
        ) : null}
      </div>

      {hint ? <p className="mb-3 text-sm text-ink-600">{hint}</p> : null}

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
          <div className="relative max-h-80 w-full bg-ink-50">
            {/* Local object URL: next/image optimisation does not apply. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`Preview of your ${label.toLowerCase()}`}
              className="mx-auto max-h-80 w-auto object-contain"
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-ink-200 px-3 py-2.5">
            <span className="truncate text-xs text-ink-500">
              {(file.size / (1024 * 1024)).toFixed(1)} MB
            </span>
            <div className="flex gap-2">
              {allowRemove ? (
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  Remove
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                Change image
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
              "flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
              dragging
                ? "border-brand-500 bg-brand-50"
                : "border-ink-300 bg-white hover:border-brand-400 hover:bg-brand-50/40",
            )}
          >
            {processing ? (
              <>
                <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-ink-400" />
                <span className="text-sm font-semibold text-ink-700">Preparing your image…</span>
              </>
            ) : (
              <>
                <ImagePlus aria-hidden="true" className="h-7 w-7 text-brand-600" />
                <span className="text-sm font-semibold text-ink-900">Tap to upload</span>
                <span className="text-xs text-ink-500">
                  JPG, PNG or WEBP · up to 10 MB · or drag and drop
                </span>
              </>
            )}
          </button>
        </div>
      )}

      <FieldError id={errorId} message={message} />
    </div>
  );
}
