import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/customer/BrandHeader";
import { Disclaimer } from "@/components/customer/Disclaimer";
import { BRAND_NAME, SCREENSHOT_RETENTION_DAYS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5">
      <BrandHeader />

      <main className="flex-1 pb-10">
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-900">Privacy</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          {BRAND_NAME} compares the basket you send us against another delivery app and sends you the
          result. This page explains, in plain language, what we hold and why.
        </p>

        <Section title="What we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>your cart screenshot</li>
            <li>your checkout screenshot, if you choose to add one</li>
            <li>the Dubai area you selected</li>
            <li>the delivery app you are ordering from</li>
            <li>the order total you typed in</li>
            <li>your WhatsApp number or email address</li>
          </ul>
          <p>
            We do not ask for your location, and you do not need an account to use {BRAND_NAME}.
          </p>
        </Section>

        <Section title="Why we collect it">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>to carry out the price comparison you asked for</li>
            <li>to send you the result</li>
          </ul>
          <p>
            Sending us a comparison lets us reply to you about that request. It does not sign you up
            to marketing. We only send you offers if you ticked the box asking for them, and you can
            tell us to stop at any time.
          </p>
        </Section>

        <Section title="A note about screenshots">
          <p>
            A delivery-app screenshot can show more than your basket — your name, your saved
            address, your phone number or previous orders may be visible on the same screen. Please
            crop or avoid uploading anything you would rather not share. We only need to see the
            restaurant, the items and the quantities.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            Screenshots are stored privately and are not publicly accessible. Only {BRAND_NAME} staff
            carrying out your comparison can open them, through short-lived links that expire.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep uploaded screenshots for up to {SCREENSHOT_RETENTION_DAYS} days after your
            comparison, then remove them. We keep a record of the comparison itself (the totals, the
            area and the app) so we can understand where switching apps genuinely saves people money.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can ask us to delete your submission and screenshots, or to stop contacting you, by
            replying to the message we send you.
          </p>
        </Section>

        <Section title="Independence">
          <Disclaimer className="text-sm text-ink-600" />
        </Section>

        <p className="mt-10 text-sm">
          <Link href="/" className="font-semibold text-ink-800 underline underline-offset-2">
            Back to {BRAND_NAME}
          </Link>
        </p>
      </main>
    </div>
  );
}
