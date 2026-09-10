import type { Metadata } from "next";
import { CompareWizard } from "@/components/customer/wizard/CompareWizard";
import { getPublicAreas } from "@/lib/areas";

export const metadata: Metadata = {
  title: "Check my order",
  robots: { index: false, follow: false },
};

// Areas are managed from the admin dashboard, so this page is rendered per
// request rather than cached at build time.
export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const areas = await getPublicAreas();
  return <CompareWizard areas={areas} />;
}
