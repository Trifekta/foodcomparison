import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { CART, PAYOFF, VOICE, sec } from "./spec";

/**
 * Sound design as the rhythm, with no bed under it.
 *
 * V2 carried a continuous 120bpm track and cut the picture to it. This one has
 * no music at all: the ticks of the basket matching ARE the rhythm section, and
 * the two impacts are the only events that are meant to be noticed as events.
 * The long silences are material, not gaps - particularly the 1.2 seconds
 * between 87 landing and 25 arriving, which is the loudest thing in the film.
 *
 * Rough pass. Levels here are placed, not mixed; the mastering to the brief's
 * -14 to -16 LUFS comes after the picture is signed off.
 */

const SFX = (n: string) => staticFile(`ad/sfx/${n}.wav`);

function Hit({ at, name, volume }: { at: number; name: string; volume: number }) {
  return (
    <Sequence from={Math.round(at)} durationInFrames={120} layout="none">
      <Audio src={SFX(name)} volume={volume} />
    </Sequence>
  );
}

/**
 * The voiceover, when it exists.
 *
 * Four lines, placed at the frames spec.ts names. Nothing renders until the
 * files are dropped in - the film is built to work silent, so this adds
 * emphasis rather than carrying meaning.
 */
const VOICE_DIR: string | null = null;

function VoiceOver() {
  if (!VOICE_DIR) return null;
  return (
    <>
      {VOICE.map((l) => (
        <Sequence key={l.id} from={l.from} layout="none">
          <Audio src={staticFile(`${VOICE_DIR}/${l.id}.wav`)} volume={1} />
        </Sequence>
      ))}
    </>
  );
}

export function Mix() {
  const ticks = CART.lines.map((_, i) => sec(5.1) + i * 4.5);

  return (
    <>
      <VoiceOver />

      {/* Act 1 - the brackets notice, then lock. One low impact on the total. */}
      <Hit at={sec(1.42)} name="snap" volume={0.22} />
      <Hit at={sec(1.95)} name="impact-87" volume={0.30} />

      {/* Act 2 - the capture, and the carry. */}
      <Hit at={sec(3.05)} name="shutter" volume={0.36} />
      <Hit at={sec(3.55)} name="swoosh" volume={0.26} />

      {/* Act 3 - the rhythm. */}
      <Hit at={sec(4.8)} name="tick" volume={0.20} />
      {ticks.map((t, i) => (
        <Hit key={t} at={t} name="tick" volume={0.17 + i * 0.014} />
      ))}
      <Hit at={sec(6.5)} name="scan" volume={0.16} />

      {/* The wipe into the dark act. */}
      <Hit at={sec(7.42)} name="swoosh" volume={0.40} />

      {/* Act 4 - controlled, then the biggest hit in the film, then nothing. */}
      <Hit at={PAYOFF.land87} name="impact-87" volume={0.52} />
      <Hit at={PAYOFF.land25} name="impact-25" volume={1.0} />

      {/* Act 5 - one soft transition only. */}
      <Hit at={sec(11.85)} name="swoosh" volume={0.20} />

      {/* Act 6 - the brackets land, the button, the sting. */}
      <Hit at={sec(15.45)} name="tap" volume={0.24} />
      <Hit at={sec(15.75)} name="button" volume={0.30} />
      <Hit at={sec(16.6)} name="tick" volume={0.18} />
    </>
  );
}
