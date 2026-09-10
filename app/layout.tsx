import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { PRODUCT_NAME } from "@/lib/constants";

// Self-hosted at build time by next/font, so there is no runtime request to
// Google and no layout shift.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT_NAME} — check if your food order is cheaper elsewhere`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    "Upload your food cart and we'll check whether the same order may cost less on another delivery app in Dubai.",
  applicationName: PRODUCT_NAME,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
