import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { AUDIO } from "./slots";
import { DUCK_WINDOWS, VOICE } from "./vo";
import { MARKS, PAYOFF, beat } from "./spec";

/**
 * The mix.
 *
 * Hierarchy, loudest first: voice, music, effects. The voice is the only thing
 * that must always be intelligible, so the music ducks under it and the effects
 * never rise to meet it.
 *
 * Every effect below is placed on a frame that already exists in spec.ts - the
 * shutter is on the cut, the ticks are the same eighth notes the basket lines
 * match on, the big impact is the same bar downbeat the saving lands on. Nothing
 * is placed by ear, which is why the picture and the audio cannot drift apart
 * when a beat is re-timed.
 */

const SFX = (name: string) => staticFile(`ad/sfx/${name}.wav`);

/** One effect, at one frame, at one level. */
function Hit({ at, name, volume }: { at: number; name: string; volume: number }) {
  return (
    <Sequence from={at} durationInFrames={90} layout="none">
      <Audio src={SFX(name)} volume={volume} />
    </Sequence>
  );
}

/**
 * Music, ducked under speech.
 *
 * The duck only engages once there is a voiceover to duck under - with no voice
 * recorded, holding the bed down for eleven of seventeen seconds would just make
 * the ad quieter for nothing. The windows come from vo.ts, so re-timing a line
 * moves its duck with it.
 */
function MusicBed() {
  if (!AUDIO.music) return null;

  const hasVoice = AUDIO.voiceDir !== null;
  const base = hasVoice ? 0.62 : 0.78;
  const ducked = 0.30;

  return (
    <Audio
      src={staticFile(AUDIO.music)}
      volume={(frame) => {
        if (!hasVoice) return base;

        // Smooth, not a gate: 6 frames down, 10 back up.
        let level = base;
        for (const window of DUCK_WINDOWS) {
          if (frame >= window.from - 6 && frame <= window.to + 10) {
            const into = Math.min(1, Math.max(0, (frame - (window.from - 6)) / 6));
            const outOf = Math.min(1, Math.max(0, (window.to + 10 - frame) / 10));
            const depth = Math.min(into, outOf);
            level = Math.min(level, base + (ducked - base) * depth);
          }
        }
        return level;
      }}
    />
  );
}

/**
 * The voiceover, line by line at the frames vo.ts specifies.
 *
 * Renders nothing until the lines are recorded and `AUDIO.voiceDir` is set. The
 * ad is silent of speech until then, which is a gap that shows rather than one
 * that hides - the alternative, a synthetic read left in "for now", is the sort
 * of thing that ends up in a published cut.
 */
function VoiceOver() {
  if (!AUDIO.voiceDir) return null;

  return (
    <>
      {VOICE.map((line) => (
        <Sequence key={line.id} from={line.from} layout="none">
          <Audio src={staticFile(`${AUDIO.voiceDir}/${line.id}.wav`)} volume={1} />
        </Sequence>
      ))}
    </>
  );
}

export function Mix() {
  // The six basket lines matching, on eighth notes - the same arithmetic the
  // picture uses in Compare.tsx.
  const ticks = Array.from({ length: 6 }, (_, i) =>
    Math.round(MARKS.compareIn - 6 + (i + 1) * 7.5),
  );

  return (
    <>
      <MusicBed />
      <VoiceOver />

      {/* The screenshot. On the cut, which is also where the picture flashes. */}
      <Hit at={MARKS.interruptIn} name="shutter" volume={0.34} />

      {/* Into the product. */}
      <Hit at={MARKS.uploadIn - 4} name="swoosh" volume={0.30} />
      <Hit at={MARKS.uploadIn + 20} name="tap" volume={0.22} />

      {/* The check running, then each line found. */}
      <Hit at={MARKS.compareIn} name="scan" volume={0.20} />
      {ticks.map((at, i) => (
        <Hit key={at} at={at} name="tick" volume={0.15 + i * 0.012} />
      ))}

      {/* The price changing, and the two moments that carry the ad. */}
      <Hit at={PAYOFF.snapNew} name="snap" volume={0.30} />
      <Hit at={PAYOFF.snapNew} name="impact-87" volume={0.40} />
      <Hit at={PAYOFF.saveHit} name="impact-25" volume={0.92} />

      {/* The food cut, and the button. */}
      <Hit at={beat(26)} name="swoosh" volume={0.16} />
      <Hit at={MARKS.ctaIn + 28} name="button" volume={0.28} />
    </>
  );
}
