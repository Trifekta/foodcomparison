import { AREA_FUNNEL_STEPS, type AreaFunnelCount } from "@/lib/analytics/funnel";

/**
 * How far visits from each area got.
 *
 * The funnel above says which screen loses people; this says where they were
 * standing. An area that reaches the total step and then stops is a supply
 * problem - nothing there is on the comparison app - and an area nobody arrives
 * from at all is an advert problem. The two look identical in a single funnel
 * and need opposite responses.
 *
 * Only the steps from the area onwards appear, because that is the first moment
 * a visit has an area at all. Anyone who stopped before it is in the funnel
 * above and cannot honestly be placed on a map.
 */
export function AreaFunnelTable({ areas }: { areas: AreaFunnelCount[] }) {
  if (areas.length === 0) {
    return (
      <section className="rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-base font-semibold text-ink-900">How far visits got, by area</h2>
        <p className="mt-2 text-sm text-ink-500">
          Nobody has reached the area step in this range yet. It fills in as soon as a customer
          picks where they are.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <h2 className="text-base font-semibold text-ink-900">How far visits got, by area</h2>
      <p className="mt-0.5 text-sm text-ink-500">
        Counted by visit, from the area step onwards · busiest first
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th scope="col" className="py-2 pr-4">
                Area
              </th>
              {AREA_FUNNEL_STEPS.map((step) => (
                <th key={step.event} scope="col" className="py-2 pr-4 text-right">
                  {step.label}
                </th>
              ))}
              <th scope="col" className="py-2 text-right">
                Reached Keeta
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {areas.map((area) => (
              <tr key={area.area}>
                <th scope="row" className="py-2.5 pr-4 font-semibold text-ink-900">
                  {area.area}
                </th>
                {area.counts.map((count, index) => (
                  <td
                    key={AREA_FUNNEL_STEPS[index].event}
                    className="py-2.5 pr-4 text-right tabular-nums text-ink-700"
                  >
                    {count}
                  </td>
                ))}
                <td
                  className={`py-2.5 text-right font-bold tabular-nums ${
                    area.conversion >= 50 ? "text-emerald-700" : "text-ink-900"
                  }`}
                >
                  {area.conversion.toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
