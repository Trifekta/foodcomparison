import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PRODUCT_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT_NAME} by Trifekta — check if your food order is cheaper elsewhere`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    "Upload your food cart and we'll check whether the same order may cost less on another delivery app in Dubai.",
  applicationName: PRODUCT_NAME,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
