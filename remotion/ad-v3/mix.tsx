import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { PAYOFF, VOICE, sec } from "./spec";
import { GROUPS } from "./elements";

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
  return (
    <>
      <VoiceOver />

      {/* Act 1 - the brackets notice, then lock. One low impact on the total. */}
      <Hit at={sec(1.42)} name="snap" volume={0.22} />
      <Hit at={sec(1.95)} name="impact-87" volume={0.30} />

      {/* Act 2 - the capture, the punctuation, the carry. */}
      <Hit at={sec(3.05)} name="shutter" volume={0.36} />
      <Hit at={sec(3.52)} name="swoosh" volume={0.24} />

      {/* Act 3 - the card comes apart, then four verifications. The ticks are
          the rhythm section; they are placed on the same frames the brackets
          arrive on, which is why they read as the brackets doing something
          rather than as a loop underneath. */}
      <Hit at={sec(4.4)} name="swoosh" volume={0.26} />
      {GROUPS.map((g, i) => (
        <Hit key={g.id} at={g.visitAt} name="tick" volume={0.2 + i * 0.02} />
      ))}
      <Hit at={sec(6.62)} name="scan" volume={0.17} />

      {/* The wipe into the dark act. */}
      <Hit at={sec(7.42)} name="swoosh" volume={0.40} />

      {/* Act 4 - controlled, then the biggest hit in the film, then nothing. */}
      <Hit at={PAYOFF.land87} name="impact-87" volume={0.52} />
      <Hit at={PAYOFF.land25} name="impact-25" volume={1.0} />

      {/* Act 5 - the stroke uncovering the food. One sound. */}
      <Hit at={sec(11.42)} name="swoosh" volume={0.30} />

      {/* Act 6 - the brackets land, the button, the ring. */}
      <Hit at={sec(14.45)} name="tap" volume={0.26} />
      <Hit at={sec(15.2)} name="button" volume={0.30} />
      <Hit at={sec(15.45)} name="tick" volume={0.18} />
    </>
  );
}
