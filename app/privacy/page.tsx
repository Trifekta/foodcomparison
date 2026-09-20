import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/customer/BrandHeader";
import { Disclaimer } from "@/components/customer/Disclaimer";
import { BRAND_NAME, SCREENSHOT_RETENTION_DAYS } from "@/lib/constants";
import { isExtractionConfigured } from "@/lib/env";
import { isMetaPixelConfigured } from "@/lib/analytics/meta-pixel";

export const metadata: Metadata = {
  title: "Privacy",
};

// Rendered per request, not prerendered. The screenshot-reading disclosure below
// depends on whether an API key is present, and that key is a runtime secret -
// at build time it does not exist, so a prerendered page would permanently claim
// we do not read screenshots while the deployed app quietly does.
export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  // The disclosure below has to describe what this deployment actually does, so
  // it follows the configuration rather than being written in by hand.
  const readsScreenshots = isExtractionConfigured();

  // Same reasoning: only disclose the pixel on a build that actually loads it.
  const tracksAds = isMetaPixelConfigured();

  return (
    <div className="safe-bottom mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5">
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
            <li>the delivery area you selected</li>
            <li>the order total you typed in</li>
            <li>your WhatsApp number</li>
          </ul>
          <p>
            We also note which delivery app your screenshot came from, which we can see by looking
            at it. We do not ask for your location, and you do not need an account to use{" "}
            {BRAND_NAME}.
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

        <Section title="Your result link">
          <p>
            Every price check gets its own private link. It is a long random address that nobody can
            guess, and it is the only way to open your result — we send it to you and it appears
            nowhere else. Anyone you forward it to can see that result, so treat it as yours.
          </p>
          <p>
            The page shows your basket, the two prices and the saving. It never shows your phone
            number or your screenshots.
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

        <Section title="How your order is read">
          {readsScreenshots ? (
            <>
              <p>
                When you upload a screenshot, it is sent to Anthropic&apos;s Claude API to be
                read, and the restaurant, items and totals it finds are filled into the next
                screen for you. This happens automatically, as soon as you upload, and it
                happens outside the UAE.
              </p>
              <p>
                Anthropic reads it on our behalf to answer that one request and does not use it
                to train their models. We do not keep a copy of the reading — the screenshot you
                upload is stored with us in the ordinary way, and the reading itself is used to
                fill the form and then discarded.
              </p>
              <p>
                If that reading cannot be done — it is switched off, or the service is
                unavailable — your own phone reads the screenshot instead, inside your browser,
                and nothing is sent anywhere to do it.
              </p>
            </>
          ) : (
            <p>
              When you upload a screenshot, your own phone reads the text off it and fills in the
              next screen. That happens entirely on your device — the reading is done by software
              running inside your browser, and nothing is sent anywhere to do it.
            </p>
          )}
          <p>
            Either way, what it produces is a first guess, not a decision. It is shown to you to
            correct, and what we keep is the version you confirmed.
          </p>
        </Section>

        {readsScreenshots ? (
          <Section title="If our staff need a second look">
            <p>
              While working on your comparison, a member of staff may read the screenshot again —
              either by having their own computer read the text off it and sending only that{" "}
              <em>text</em> to Anthropic, or by sending the screenshot itself, as happened when you
              uploaded it. Both go to the same place, on the same terms.
            </p>
            <p>
              Nothing read this way is treated as final either. A member of staff checks and
              corrects it before it is used, and it never replaces the restaurant or the total you
              confirmed yourself.
            </p>
          </Section>
        ) : null}

        <Section title="Who can see it">
          <p>
            Screenshots are stored privately and are not publicly accessible. Only {BRAND_NAME} staff
            carrying out your comparison can open them, through short-lived links that expire
            {readsScreenshots
              ? ", and the reading service described above, in the uncommon case where a staff member sends it there"
              : ""}
            .
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep uploaded screenshots for up to {SCREENSHOT_RETENTION_DAYS} days after your
            comparison, then remove them. We keep a record of the comparison itself (the totals, the
            area and the app) so we can understand where switching apps genuinely saves people money.
          </p>
        </Section>

        {tracksAds ? (
          <Section title="Ads and measurement">
            <p>
              We run ads on Facebook and Instagram, and this site loads Meta&apos;s pixel so we can
              see how many people who tapped one of those ads went on to send us a price check. It
              tells us that a visit happened and which page it was on. We do not send it your
              screenshots, your phone number, your basket or your result.
            </p>
            <p>
              Meta sets its own cookies through it and may use what it collects for its own
              purposes, as described in their privacy policy. Your browser&apos;s tracking
              settings, or any content blocker, stop it — nothing on {BRAND_NAME} needs it to
              work, and your comparison is carried out exactly the same way without it. It is not
              loaded on our staff pages.
            </p>
          </Section>
        ) : null}

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
          <Link
            href="/"
            className="inline-flex min-h-11 items-center px-1.5 font-semibold text-ink-800 underline underline-offset-2"
          >
            Back to {BRAND_NAME}
          </Link>
        </p>
      </main>
    </div>
  );
}
