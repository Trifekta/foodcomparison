import type { Metadata, Viewport } from "next";
import { Caveat, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from "@/lib/constants";
import { socialCard } from "@/lib/metadata";
import { absoluteUrl } from "@/lib/env";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { MetaPixel } from "@/components/MetaPixel";

// Self-hosted at build time by next/font, so there is no runtime request to
// Google and no layout shift.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

// Handwritten accent for the taglines and speech bubbles.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-caveat",
  display: "swap",
});

const appOrigin = absoluteUrl("/");
const metadataBaseUrl = appOrigin ? new URL(appOrigin) : undefined;

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT_NAME} — check if your food order is cheaper elsewhere`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: PRODUCT_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  robots: { index: true, follow: true },

  /**
   * What a relative URL in any metadata below resolves against.
   *
   * Undefined rather than a fallback when NEXT_PUBLIC_APP_URL is unset: Next
   * would otherwise quietly resolve against localhost, and every page in the
   * build would advertise an address only this machine can reach.
   */
  metadataBase: metadataBaseUrl,

  /**
   * The default link preview, inherited by every page that does not set its own.
   *
   * It is what somebody sees when the landing page is pasted into a chat, which
   * during validation is how most of the first customers arrive.
   */
  ...socialCard({
    title: `${PRODUCT_NAME} — is your food order cheaper elsewhere?`,
    description: PRODUCT_DESCRIPTION,
    image: "/og/default.png",
    imageAlt: `${PRODUCT_NAME} — send your cart screenshot and we check the same order on another delivery app in Dubai.`,
    path: "/",
  }),

  /**
   * What iOS reads when somebody adds this to their Home Screen.
   *
   * Only meaningful once installed - nothing here prompts for that, and nothing
   * should while the product is still being validated. It is the difference
   * between the installed copy opening as an app and opening as a browser tab
   * with a bookmark, and it costs two tags now rather than a migration later.
   *
   * The status bar is translucent so the page's own cream runs under the clock,
   * which is the whole point of viewportFit above.
   */
  appleWebApp: {
    capable: true,
    title: PRODUCT_NAME,
    statusBarStyle: "default",
  },

  /** Phone numbers are collected in a field, not linked in prose. */
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fdfaf4",
  width: "device-width",
  initialScale: 1,
  /**
   * The line that makes every safe-area rule in this codebase work.
   *
   * Without it iOS letterboxes the page inside the notch and home indicator,
   * and every env(safe-area-inset-*) reads zero - so the padding written to
   * clear them was doing nothing at all. With it the page reaches the physical
   * edges, which is what makes a web page stop looking like one, and the
   * insets become real numbers the layout can respect.
   *
   * It is deliberately paired with the padding below rather than shipped alone:
   * cover without insets is a home indicator sitting on top of a button.
   */
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${caveat.variable}`}>
      <body className="min-h-dvh antialiased">
        <PresenceHeartbeat />
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
