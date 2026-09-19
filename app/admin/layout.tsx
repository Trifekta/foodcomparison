import type { Metadata } from "next";

/**
 * Nothing but metadata.
 *
 * Wraps both /admin/login and everything under /admin/(protected) - the two
 * independent trees under here - so the admin manifest link applies whichever
 * one an admin happens to add to their home screen from. See
 * app/admin/manifest.webmanifest/route.ts for why this needs to differ from
 * the root layout's manifest at all.
 */
export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
