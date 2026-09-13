import { BROLL } from "../slots";
import { COPY } from "../spec";
import { Footage, PopIn, RiseIn, Stage } from "../kit";

/**
 * Beat two: the only photographic frame in the ad.
 *
 * The reference spends its entire footage budget on one card like this and
 * carries the other sixteen seconds on typography, which is most of the reason
 * it looks expensive rather than stocky. One good shot reads as art direction;
 * six of them read as a slideshow of whatever the stock library had.
 *
 * The line sits under the card rather than over it, because text over moving
 * footage is the one thing that has to survive compression on a phone.
 */
export function BRoll() {
  return (
    <Stage>
      <div className="flex flex-col items-center gap-12">
        <PopIn from={0.92}>
          <div className="h-[520px] w-[1100px] overflow-hidden rounded-[40px] bg-beige">
            <Footage slot={BROLL} />
          </div>
        </PopIn>

        <RiseIn delay={12} distance={26}>
          <p className="text-center text-[62px] font-extrabold tracking-tight">
            {COPY.brollLine}{" "}
            <span className="marker">{COPY.brollEmphasis}</span>
          </p>
        </RiseIn>
      </div>
    </Stage>
  );
}
