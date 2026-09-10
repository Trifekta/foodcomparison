import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { BRAND_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only same-site paths are accepted, so ?next= cannot bounce anyone off-site.
  const target = next && next.startsWith("/admin") ? next : "/admin";

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-black tracking-[0.28em] text-ink-900">
          {BRAND_NAME}
        </p>
        <h1 className="mt-2 text-center text-xl font-bold text-ink-900">Admin sign in</h1>
        <p className="mt-1.5 text-center text-sm text-ink-500">
          For the Trifekta comparison team.
        </p>

        <div className="mt-7 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <LoginForm next={target} />
        </div>
      </div>
    </div>
  );
}
