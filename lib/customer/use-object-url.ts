"use client";

import { useEffect, useState } from "react";

/** Preview failure must never discard the file or crash the wizard. */
export function useObjectUrl(file: File | null): string | null {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    let url: string | null = null;
    try {
      if (file) url = URL.createObjectURL(file);
    } catch {
      // Some embedded browsers cannot create a preview for a selected file.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- owns an external resource per file
    setPreview(file && url ? { file, url } : null);
    return () => {
      try {
        if (url) URL.revokeObjectURL(url);
      } catch {
        // A preview cleanup failure must not break navigation or replacement.
      }
    };
  }, [file]);

  // Never display the previous file while its replacement's effect is pending.
  return preview?.file === file ? preview.url : null;
}
