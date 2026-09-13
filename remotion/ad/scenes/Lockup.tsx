import { Wordmark } from "@/components/customer/Wordmark";
import { COPY } from "../spec";
import { GuideRules, PopIn, RiseIn, Stage } from "../kit";

/**
 * Beat nine: the lockup.
 *
 * The wordmark here is the shipping component, imported and scaled rather than
 * rebuilt at video size. Its sizes stop at text-2xl because that is the largest
 * any screen in the app needs, and a transform is the honest way to reach 1080p
 * with it: every stroke, gap and corner radius scales together, and the mark in
 * the last frame of the ad is provably the mark in the header of the page the
 * ad sends people to.
 *
 * The alternative - a second wordmark drawn for the video - looks identical on
 * the day it is written and diverges quietly ever after.
 */
export function Lockup() {
  return (
    <Stage>
      <GuideRules delay={2} gap={260} />

      <div className="flex flex-col items-center gap-14">
        <PopIn from={0.82}>
          {/* The transform scales about the centre and takes no layout space
              with it, so the wrapper reserves the height the scaled mark
              actually occupies. */}
          <div className="flex h-[190px] items-center justify-center">
            <div style={{ transform: "scale(5)" }}>
              <Wordmark size="lg" />
            </div>
          </div>
        </PopIn>

        <RiseIn delay={16} distance={24}>
          <p className="text-center text-[56px] font-extrabold tracking-tight text-ink-900">
            {COPY.tagline}
          </p>
        </RiseIn>

        <RiseIn delay={26} distance={18}>
          <p className="text-[38px] font-semibold text-slate-500">{COPY.city}</p>
        </RiseIn>
      </div>
    </Stage>
  );
}
