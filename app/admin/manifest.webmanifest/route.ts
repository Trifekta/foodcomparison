import { NextResponse } from "next/server";
import { PRODUCT_NAME } from "@/lib/constants";

/**
 * A second manifest, for the admin only.
 *
 * The customer manifest (app/manifest.ts) has start_url "/" - correct for a
 * customer adding the site to their home screen, wrong for an admin adding
 * /admin: the same manifest would have their icon reopen the customer
 * landing page instead of the dashboard, because a home-screen icon's
 * start_url comes from whichever manifest is linked, not from the page that
 * was open when it was added. Scoping this one to /admin, and linking it
 * only from app/admin/layout.tsx, is what makes the admin's icon open the
 * admin.
 *
 * A route handler rather than the special manifest.ts convention: in this
 * Next.js version that convention is root-app-directory only (see
 * node_modules/next/dist/docs/.../metadata/manifest.md), so a second,
 * differently-scoped manifest has to be served by hand.
 */
export function GET() {
  return NextResponse.json(
    {
      name: `${PRODUCT_NAME} Admin`,
      short_name: "Admin",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#fdfaf4",
      theme_color: "#fdfaf4",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        {
          src: "/icons/maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
