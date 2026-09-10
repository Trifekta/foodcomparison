"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Mail, MessageCircle, Send } from "lucide-react";
import { markResultSent, sendResultByEmail } from "@/lib/admin/actions";
import { buildMailtoLink, buildResultSubject, buildWhatsAppLink } from "@/lib/notifications/messages";
import { Button } from "@/components/ui/Button";

interface ResultPanelProps {
  submissionId: string;
  reference: string;
  message: string;
  hasSaving: boolean;
  contactType: "whatsapp" | "email";
  whatsappNumber: string | null;
  email: string | null;
  alreadySent: boolean;
  emailConfigured: boolean;
}

/**
 * Sending the result.
 *
 * Phase 1 has no WhatsApp Business API: the admin opens a prefilled wa.me link
 * and sends it themselves. Opening that link is not treated as delivery -
 * "Mark as sent" stays a separate, deliberate action.
 */
export function ResultPanel({
  submissionId,
  reference,
  message,
  hasSaving,
  contactType,
  whatsappNumber,
  email,
  alreadySent,
  emailConfigured,
}: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback("Couldn't copy automatically — select the message and copy it manually.");
    }
  };

  const onMarkSent = () => {
    startTransition(async () => {
      const result = await markResultSent(submissionId);
      setFeedback(result.message ?? (result.ok ? "Marked as sent." : "Could not update."));
    });
  };

  const onSendEmail = () => {
    startTransition(async () => {
      const result = await sendResultByEmail(submissionId);
      setFeedback(result.message ?? (result.ok ? "Email sent." : "Could not send."));
    });
  };

  const subject = buildResultSubject(hasSaving, reference);

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink-900">Customer result</h2>
        {alreadySent ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-300">
            Sent
          </span>
        ) : null}
      </div>

      <pre className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-ink-200 bg-ink-50 p-4 font-sans text-sm leading-relaxed text-ink-800">
        {message}
      </pre>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {contactType === "whatsapp" && whatsappNumber ? (
          <a
            href={buildWhatsAppLink(whatsappNumber, message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            Open in WhatsApp
          </a>
        ) : null}

        {contactType === "email" && email ? (
          emailConfigured ? (
            <Button size="md" onClick={onSendEmail} loading={pending} loadingLabel="Sending…">
              <Send aria-hidden="true" className="h-4 w-4" />
              Send email
            </Button>
          ) : (
            <a
              href={buildMailtoLink(email, subject, message)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              <Mail aria-hidden="true" className="h-4 w-4" />
              Open in email client
            </a>
          )
        ) : null}

        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50"
        >
          {copied ? (
            <Check aria-hidden="true" className="h-4 w-4 text-emerald-700" />
          ) : (
            <Copy aria-hidden="true" className="h-4 w-4" />
          )}
          {copied ? "Copied" : contactType === "email" ? "Copy email message" : "Copy message"}
        </button>
      </div>

      {contactType === "email" && !emailConfigured ? (
        <p className="mt-3 text-xs text-ink-500">
          Resend isn&apos;t configured, so send this one yourself and mark it as sent.
        </p>
      ) : null}

      {!alreadySent ? (
        <div className="mt-4 border-t border-ink-200 pt-4">
          <Button
            size="md"
            variant="secondary"
            onClick={onMarkSent}
            loading={pending}
            loadingLabel="Saving…"
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            Mark as sent
          </Button>
          <p className="mt-2 text-xs text-ink-500">
            Opening WhatsApp doesn&apos;t mark it sent — confirm here once the message has gone out.
          </p>
        </div>
      ) : null}

      {feedback ? (
        <p role="status" className="mt-3 text-sm font-medium text-ink-700">
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
