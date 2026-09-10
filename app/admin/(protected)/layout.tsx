import { requireAdmin } from "@/lib/supabase/auth";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * Server-side guard for every admin page.
 *
 * The proxy already turns away anonymous requests, but this is the check that
 * matters: it runs on the server for each render and requires an admin_profiles
 * row, not merely a Supabase account.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireAdmin();

  return (
    <div className="min-h-dvh bg-ink-50">
      <AdminNav displayName={profile.display_name ?? user.email ?? "Admin"} />
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
