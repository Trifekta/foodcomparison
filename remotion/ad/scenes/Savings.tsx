import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Sparks } from "@/components/customer/Motifs";
import { BASKET, COPY } from "../spec";
import { RiseIn, Stage } from "../kit";

/**
 * Beat seven: the number, held for three seconds.
 *
 * The longest beat in the ad, and the only one a viewer has to remember. It
 * counts up rather than cutting in because a number that moves is a number that
 * gets watched, and it settles a good half-second before the beat ends so the
 * final figure is legible standing still rather than only in motion.
 *
 * The lead line is the product's own - "You could save", not "You save". The
 * hedge is not timidity, it is accurate: phase 1 rebuilds a basket by hand at a
 * moment in time, and an ad that over-promises against the screen the customer
 * lands on is a refund request with extra steps.
 */
export function Savings() {
  const frame = useCurrentFrame();

  const counted = interpolate(frame, [8, 48], [0, Number(BASKET.saving)], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <Stage>
      <div className="flex flex-col items-center gap-9">
        <RiseIn distance={18}>
          <p className="text-[54px] font-bold tracking-tight text-ink-800">
            {COPY.savingsLead}
          </p>
        </RiseIn>

        <div className="flex items-start gap-8">
          <RiseIn delay={4} distance={40}>
            <p className="text-[210px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-chip-green-fg">
              {BASKET.currency} {counted.toFixed(2)}
            </p>
          </RiseIn>
          <RiseIn delay={30} distance={26}>
            <Sparks className="h-24 w-24" />
          </RiseIn>
        </div>

        <RiseIn delay={36} distance={20}>
          <p className="text-[44px] font-semibold text-slate-600">
            {COPY.savingsSub}
          </p>
        </RiseIn>
      </div>
    </Stage>
  );
}
