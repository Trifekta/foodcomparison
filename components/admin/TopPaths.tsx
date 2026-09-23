import type { JourneyPath } from "@/lib/calculations/visits";

/**
 * The same journey, walked by several people.
 *
 * One visit's path is an anecdote. Twelve visits that all read "Have a
 * screenshot › Uploaded › Left" is a screen losing people at a nameable
 * moment, which is the thing an exit survey was going to be built to ask and
 * this answers from behaviour instead.
 *
 * Sorted commonest first and capped, because the tail of a path report is
 * always one-offs: every visit that did something slightly unusual gets its
 * own row, and reading them tells you nothing that the top ten do not.
 */
const MAX_PATHS = 12;

export function TopPaths({ paths }: { paths: JourneyPath[] }) {
  const shown = paths.slice(0, MAX_PATHS);
  const hiddenVisits = paths.slice(MAX_PATHS).reduce((sum, path) => sum + path.visits, 0);
  const busiest = shown[0]?.visits ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-700">Top paths</h2>
        <p className="text-xs text-ink-500">
          Identical journeys, counted. The last step is how the visit ended.
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center">
          <p className="text-sm text-ink-500">No journeys in this range yet.</p>
        </div>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
          {shown.map((path) => (
            <li
              key={path.steps.join("\u0000")}
              className="relative border-b border-ink-100 px-4 py-2.5 last:border-b-0"
            >
              {/* A bar behind the row rather than a number beside it: the
                  question here is which paths dominate, and a length is read
                  faster than a count. Widths are relative to the busiest path,
                  so the top row always fills. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 bg-brand-50"
                style={{ width: busiest > 0 ? `${(path.visits / busiest) * 100}%` : "0%" }}
              />
              <div className="relative flex items-baseline justify-between gap-4">
                <span className="text-[0.8rem] leading-snug text-ink-700">
                  {path.steps.map((step, index) => (
                    <span key={`${step}-${index}`}>
                      {index > 0 ? (
                        <span aria-hidden="true" className="text-ink-300"> › </span>
                      ) : null}
                      <span
                        className={index === path.steps.length - 1 ? "font-semibold" : undefined}
                      >
                        {step}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-ink-900">
                  {path.visits}
                  {path.completed > 0 ? (
                    <span
                      className="ml-1.5 text-xs font-semibold text-emerald-700"
                      title={`${path.completed} of these sent an order`}
                    >
                      ✓{path.completed}
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {hiddenVisits > 0 ? (
        <p className="text-xs text-ink-500">
          {hiddenVisits} more {hiddenVisits === 1 ? "visit" : "visits"} took a path of its own.
        </p>
      ) : null}
    </section>
  );
}
