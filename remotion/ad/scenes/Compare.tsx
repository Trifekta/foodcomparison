import { AbsoluteFill } from "remotion";
import { BASKET, COLUMNS, COPY } from "../spec";
import { Card, PopIn, RiseIn, Stage, useEntrance } from "../kit";

/**
 * One priced column. The cheaper side carries the green and the weight.
 *
 * The currency sits on its own line above the figure rather than inline with
 * it. Two reasons: "AED 112.00" set at the size this beat needs is wider than
 * any card that still leaves room beside it, and separating them means the two
 * columns align on the digits, which is what the eye is actually comparing.
 */
function PriceColumn({ label, amount, delay, cheaper }: {
  label: string;
  amount: string;
  delay: number;
  cheaper: boolean;
}) {
  return (
    <PopIn delay={delay} from={0.9}>
      <Card
        tone={cheaper ? "highlight" : "plain"}
        className="flex h-[340px] w-[560px] flex-col items-center justify-center gap-4 px-10"
      >
        <p className="text-center text-[30px] font-semibold text-slate-600">
          {label}
        </p>
        <p
          className={
            cheaper
              ? "text-[34px] font-bold tracking-wide text-chip-green-fg"
              : "text-[34px] font-bold tracking-wide text-ink-400"
          }
        >
          {BASKET.currency}
        </p>
        <p
          className={
            cheaper
              ? "text-[104px] font-extrabold tabular-nums leading-none tracking-tight text-chip-green-fg"
              : "text-[104px] font-extrabold tabular-nums leading-none tracking-tight text-ink-400 line-through decoration-[7px]"
          }
        >
          {amount}
        </p>
      </Card>
    </PopIn>
  );
}

/**
 * Beat six: the two numbers, together, for a second and a half.
 *
 * Short on purpose. The comparison is the evidence, not the message - it exists
 * so the number in the next beat is believed, and holding on it any longer
 * invites the viewer to start reading the column headings instead of watching
 * the saving land.
 */
export function Compare() {
  const rule = useEntrance(8);

  return (
    <Stage>
      <div className="flex flex-col items-center gap-14">
        <RiseIn distance={14}>
          <h2 className="text-center text-[56px] font-extrabold tracking-tight">
            {COPY.compareTitle}
          </h2>
        </RiseIn>

        <div className="relative flex items-center gap-16">
          <PriceColumn
            label={COLUMNS.current}
            amount={BASKET.cartTotal}
            delay={4}
            cheaper={false}
          />

          <AbsoluteFill className="items-center justify-center" aria-hidden="true">
            <div
              className="w-px border-l-2 border-dashed border-ink-300 h-[260px]"
              style={{ opacity: rule, transform: `scaleY(${rule})` }}
            />
          </AbsoluteFill>

          <PriceColumn
            label={COLUMNS.comparison}
            amount={BASKET.comparisonTotal}
            delay={10}
            cheaper
          />
        </div>
      </div>
    </Stage>
  );
}
