import { Check } from "lucide-react";
import { BASKET, COPY } from "../spec";
import { Card, RiseIn, Stage, useEntrance } from "../kit";

/** One basket line, with its tick landing a beat after the row. */
function BasketRow({ name, quantity, delay }: {
  name: string;
  quantity: number | null;
  delay: number;
}) {
  const tick = useEntrance(delay + 6);

  return (
    <RiseIn delay={delay} distance={20}>
      <div className="flex items-center gap-6 border-b border-ink-100 py-7 last:border-b-0">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-chip-green-bg text-chip-green-fg"
          style={{ opacity: tick, transform: `scale(${0.6 + tick * 0.4})` }}
        >
          <Check className="h-7 w-7" strokeWidth={3.2} />
        </span>
        <span className="text-[40px] font-semibold text-ink-800">{name}</span>
        {quantity ? (
          <span className="ml-auto text-[36px] font-bold tabular-nums text-slate-500">
            &times;{quantity}
          </span>
        ) : null}
      </div>
    </RiseIn>
  );
}

/**
 * Beat five: the part that is genuinely manual, shown as the reassurance it is.
 *
 * Phase 1 rebuilds the basket by hand, line by line, and the ad does not
 * pretend otherwise - it shows four rows ticking off. That is a better promise
 * than a spinner labelled "AI", because it is what the customer's result will
 * actually be: somebody checked.
 */
export function Rebuild() {
  return (
    <Stage>
      <div className="flex flex-col items-center gap-11">
        <RiseIn distance={16}>
          <h2 className="max-w-[1180px] text-center text-[58px] font-extrabold leading-[1.12] tracking-tight">
            {COPY.rebuildTitle}
          </h2>
        </RiseIn>

        <Card className="w-[980px] px-14 py-4">
          {BASKET.items.map((item, index) => (
            <BasketRow
              key={item.name}
              name={item.name}
              quantity={item.quantity}
              delay={10 + index * 7}
            />
          ))}
        </Card>
      </div>
    </Stage>
  );
}
