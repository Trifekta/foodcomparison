import { resolveAdLabel, type AdLabelIndex, type AdLabelKind } from "@/lib/analytics/ad-labels";

/**
 * One advert value, shown as a name with its raw value underneath.
 *
 * Both lines, always, because the two are wanted for different jobs and at
 * different moments. The name is what makes a table of creatives comparable at
 * a glance; the id is what gets pasted into Ads Manager when a number looks
 * wrong. Replacing the second with the first would fix the reading problem by
 * creating a debugging one.
 *
 * An id nothing has named is shown differently rather than hidden: it keeps
 * its last six digits so two unnamed creatives are visibly two, and it is
 * marked so the admin can see the reason it reads badly is a missing label
 * rather than a broken column.
 */
export function AdLabelCell({
  kind,
  value,
  index,
}: {
  kind: AdLabelKind;
  value: string | null | undefined;
  index?: AdLabelIndex;
}) {
  const { label, raw, origin } = resolveAdLabel(kind, value, index);

  if (origin === "empty") {
    return <span className="text-ink-400">—</span>;
  }

  const unnamed = origin === "id";

  return (
    <span className="block leading-tight">
      <span
        className={
          unnamed
            ? "font-mono text-xs text-ink-500"
            : "block whitespace-nowrap font-medium text-ink-800"
        }
        title={unnamed ? `${raw} — not named yet. Add it on Ad labels.` : undefined}
      >
        {label}
        {unnamed ? (
          <span className="ml-1.5 font-sans text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700">
            unnamed
          </span>
        ) : null}
      </span>

      {/* The id, for the person checking a number against Ads Manager. Only
          when it says something the line above does not - a campaign called
          "Ramadan" does not need "ramadan" printed underneath it in grey. */}
      {raw && !unnamed ? (
        <span className="mt-0.5 block font-mono text-[0.65rem] text-ink-400" title={raw}>
          {raw}
        </span>
      ) : null}
    </span>
  );
}
