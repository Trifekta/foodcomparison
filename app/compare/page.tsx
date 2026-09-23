import type { Metadata } from "next";
import { CompareWizard } from "@/components/customer/wizard/CompareWizard";
import { getPublicAreas } from "@/lib/areas";
import { getDraftResumeMode } from "@/lib/env";

export function generateMetadata(): Metadata {
  const resume = getDraftResumeMode();
  return {
    title: "Check my order",
    robots: { index: false, follow: false },
    // Read by the Meta Pixel snippet before it initialises; see MetaPixel.
    ...(resume === "off" ? {} : { other: { "snipsavor-resume": resume } }),
  };
}

// Areas are managed from the admin dashboard, so this page is rendered per
// request rather than cached at build time.
export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const areas = await getPublicAreas();
  return <CompareWizard areas={areas} resumeMode={getDraftResumeMode()} />;
}
