import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Sparks } from "@/components/customer/Motifs";
import { BASKET, COPY } from "../spec";
import { Caption, KineticText, RiseIn, Stage } from "../kit";

/**
 * Beat one: the moment the ad is actually about.
 *
 * Not the food and not the app - the ten seconds where a full cart is sitting
 * on a phone and a thumb is over the checkout button. The reference opens on
 * "8PM" and nothing else, and the reason that works is that the viewer supplies
 * the rest themselves. A clock is enough.
 */

/** The faint horizontal rules the reference drifts behind its opening title. */
function SpeedLines() {
  const frame = useCurrentFrame();

  const lines = [
    { top: "16%", left: "6%", width: 180, delay: 0 },
    { top: "24%", left: "62%", width: 260, delay: 5 },
    { top: "35%", left: "18%", width: 120, delay: 11 },
    { top: "71%", left: "72%", width: 200, delay: 3 },
    { top: "80%", left: "10%", width: 300, delay: 8 },
    { top: "88%", left: "48%", width: 150, delay: 14 },
  ];

  return (
    <AbsoluteFill aria-hidden="true">
      {lines.map((line) => {
        const drift = interpolate(frame - line.delay, [0, 60], [40, -40], {
          extrapolateLeft: "clamp",
        });
        const opacity = interpolate(frame - line.delay, [0, 14], [0, 0.5], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={`${line.top}-${line.left}`}
            className="absolute h-[3px] rounded-full bg-ink-300"
            style={{
              top: line.top,
              left: line.left,
              width: line.width,
              opacity,
              transform: `translateX(${drift}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

export function Craving() {
  return (
    <Stage>
      <SpeedLines />

      <div className="relative flex flex-col items-center gap-8">
        <div className="flex items-start gap-6">
          <KineticText
            className="text-[230px] font-extrabold leading-none tracking-[-0.045em] tabular-nums"
            stagger={2}
          >
            {BASKET.clock}
          </KineticText>
          <RiseIn delay={16} distance={24}>
            <Sparks className="h-20 w-20" />
          </RiseIn>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Caption delay={20} className="text-[46px] text-ink-800">
            {COPY.cravingLead}
          </Caption>
          <Caption delay={26}>{COPY.cravingSub}</Caption>
        </div>
      </div>
    </Stage>
  );
}
