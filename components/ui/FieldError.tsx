import { AlertCircle } from "lucide-react";

/**
 * Error text for a form field. Rendered with an icon as well as colour so the
 * failure is not communicated by colour alone, and wired to the input with
 * aria-describedby by the caller.
 */
export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-rose-700">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
