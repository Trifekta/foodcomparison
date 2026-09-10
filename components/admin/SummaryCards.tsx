import Link from "next/link";
import type { DashboardCounts } from "@/lib/admin/queries";

/** Four operational numbers. Deliberately not a wall of vanity metrics. */
export function SummaryCards({ counts }: { counts: DashboardCounts }) {
  const cards = [
    { label: "New", value: counts.newCount, href: "/admin?status=new" },
    { label: "Reviewing", value: counts.reviewingCount, href: "/admin?status=reviewing" },
    { label: "Ready", value: counts.readyCount, href: "/admin?status=result_ready" },
    { label: "Sent today", value: counts.sentToday, href: "/admin?status=result_sent" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="rounded-2xl border border-ink-200 bg-white p-4 transition-colors hover:border-brand-400"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{card.label}</p>
          <p className="mt-1.5 text-3xl font-bold tabular-nums text-ink-900">{card.value}</p>
        </Link>
      ))}
    </div>
  );
}
