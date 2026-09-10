"use client";

import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/forms/ImageUpload";

interface StepCartProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  error: string | null;
  onContinue: () => void;
}

export function StepCart({ file, onFileChange, error, onContinue }: StepCartProps) {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Show us your cart</h1>
      <p className="mt-2 text-base text-ink-600">
        Upload a screenshot showing the restaurant, items and quantities you want to order.
      </p>

      <div className="mt-6">
        <ImageUpload label="Cart screenshot" file={file} onChange={onFileChange} error={error} />
      </div>

      <div className="mt-auto pt-8">
        <Button onClick={onContinue} disabled={!file}>
          Continue
        </Button>
      </div>
    </>
  );
}
