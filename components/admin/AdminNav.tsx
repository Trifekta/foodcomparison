import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/admin/actions";
import { BRAND_NAME } from "@/lib/constants";

const LINKS = [
  { href: "/admin", label: "Submissions" },
  { href: "/admin/analytics", label: "Validation" },
  { href: "/admin/areas", label: "Areas" },
];

export function AdminNav({ displayName }: { displayName: string }) {
  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/admin" className="text-sm font-black tracking-[0.2em] text-ink-900">
          {BRAND_NAME} <span className="font-semibold tracking-normal text-ink-400">Admin</span>
        </Link>

        <nav aria-label="Admin sections" className="flex items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-ink-500 sm:inline">{displayName}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
