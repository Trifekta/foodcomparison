import type { Metadata } from "next";
import { AreaManager } from "@/components/admin/AreaManager";
import { listAreas } from "@/lib/admin/queries";

export const metadata: Metadata = {
  title: "Areas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminAreasPage() {
  const areas = await listAreas(true);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Dubai areas</h1>
        <p className="mt-1 text-sm text-ink-500">
          These drive the customer dropdown. Test-location fields are internal and never shown to
          customers.
        </p>
      </div>
      <AreaManager areas={areas} />
    </div>
  );
}
