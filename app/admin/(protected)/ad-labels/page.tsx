import type { Metadata } from "next";
import { AdLabelManager } from "@/components/admin/AdLabelManager";
import { getAdLabelIndex, listAdLabels, listSeenAdValues } from "@/lib/admin/queries";

export const metadata: Metadata = {
  title: "Ad labels",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where a Meta ID gets a name.
 *
 * Meta's URL builder can write either {{ad.id}} or {{ad.name}} into utm_content,
 * and the adverts running today use the first - so the Live and Attribution
 * tables read as eighteen-digit numbers. This is the lookup that turns them
 * back into words, and it is a screen rather than a constant because the
 * adverts that need naming are the ones launched after the last deploy.
 */
export default async function AdLabelsPage() {
  const [labels, seen, index] = await Promise.all([
    listAdLabels(),
    listSeenAdValues(),
    getAdLabelIndex(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Ad labels</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Names for the Meta campaign and creative IDs that arrive on a visit. Display only —
          nothing here changes what is captured or stored, and every table keeps the raw ID
          underneath for checking against Ads Manager.
        </p>
      </div>

      <AdLabelManager labels={labels} seen={seen} index={index} />

      <p className="max-w-3xl text-xs text-ink-500">
        You can avoid this screen for future adverts: set the tracking parameters in Ads Manager to{" "}
        <code className="rounded bg-ink-100 px-1 py-0.5 font-mono">
          utm_campaign=&#123;&#123;campaign.name&#125;&#125;
        </code>{" "}
        and{" "}
        <code className="rounded bg-ink-100 px-1 py-0.5 font-mono">
          utm_content=&#123;&#123;ad.name&#125;&#125;
        </code>{" "}
        and Meta sends the name instead of the ID, which needs no label at all. Adverts already
        running keep sending IDs, so the rows above still matter for them.
      </p>
    </div>
  );
}
