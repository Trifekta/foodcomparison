"use client";

import { useId } from "react";
import { DIAL_CODES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils/cn";

interface StepContactProps {
  contactType: "whatsapp" | "email";
  dialCode: string;
  whatsappNumber: string;
  email: string;
  marketingConsent: boolean;
  errors: { whatsappNumber?: string; email?: string };
  onContactTypeChange: (type: "whatsapp" | "email") => void;
  onDialCodeChange: (code: string) => void;
  onWhatsappNumberChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onMarketingConsentChange: (value: boolean) => void;
  onContinue: () => void;
}

export function StepContact({
  contactType,
  dialCode,
  whatsappNumber,
  email,
  marketingConsent,
  errors,
  onContactTypeChange,
  onDialCodeChange,
  onWhatsappNumberChange,
  onEmailChange,
  onMarketingConsentChange,
  onContinue,
}: StepContactProps) {
  const phoneId = useId();
  const emailId = useId();
  const consentId = useId();

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
        Where should we send your result?
      </h1>
      <p className="mt-2 text-base text-ink-600">We only need one way to reach you.</p>

      <div className="mt-6 space-y-6">
        <RadioCardGroup
          legend="Send my result by"
          columns={2}
          options={[
            { value: "whatsapp", label: "WhatsApp" },
            { value: "email", label: "Email" },
          ]}
          value={contactType}
          onChange={(value) => onContactTypeChange(value as "whatsapp" | "email")}
        />

        {contactType === "whatsapp" ? (
          <div>
            <label htmlFor={phoneId} className="mb-2 block text-sm font-semibold text-ink-900">
              Mobile number
            </label>
            <div
              className={cn(
                "flex items-stretch rounded-xl border bg-white",
                errors.whatsappNumber ? "border-rose-400" : "border-ink-200",
              )}
            >
              <label htmlFor={`${phoneId}-code`} className="sr-only">
                Country code
              </label>
              <select
                id={`${phoneId}-code`}
                value={dialCode}
                onChange={(event) => onDialCodeChange(event.target.value)}
                className="min-h-13 rounded-l-xl border-r border-ink-200 bg-ink-50 px-3 text-base font-medium text-ink-800"
              >
                {DIAL_CODES.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code}
                  </option>
                ))}
              </select>
              <input
                id={phoneId}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="50 123 4567"
                value={whatsappNumber}
                onChange={(event) => onWhatsappNumberChange(event.target.value)}
                aria-describedby={errors.whatsappNumber ? `${phoneId}-error` : undefined}
                aria-invalid={errors.whatsappNumber ? true : undefined}
                className="min-h-13 w-full rounded-r-xl bg-transparent px-3 text-base text-ink-900 placeholder:text-ink-400"
              />
            </div>
            <FieldError id={`${phoneId}-error`} message={errors.whatsappNumber} />
          </div>
        ) : (
          <div>
            <label htmlFor={emailId} className="mb-2 block text-sm font-semibold text-ink-900">
              Email address
            </label>
            <input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              aria-invalid={errors.email ? true : undefined}
              className={cn(
                "min-h-13 w-full rounded-xl border bg-white px-4 text-base text-ink-900 placeholder:text-ink-400",
                errors.email ? "border-rose-400" : "border-ink-200",
              )}
            />
            <FieldError id={`${emailId}-error`} message={errors.email} />
          </div>
        )}

        {/*
          Marketing consent is separate from service communication. Submitting a
          comparison lets us reply about THAT request; this box is the only thing
          that opts someone into anything else, and it starts off.
        */}
        <label
          htmlFor={consentId}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white p-4"
        >
          <input
            id={consentId}
            type="checkbox"
            checked={marketingConsent}
            onChange={(event) => onMarketingConsentChange(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 accent-brand-500"
          />
          <span className="text-sm text-ink-700">
            I&apos;d like to hear about future Trifekta offers.
          </span>
        </label>
      </div>

      <div className="mt-auto pt-8">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </>
  );
}
