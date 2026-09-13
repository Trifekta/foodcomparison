import { MARKS, PAYOFF, beat } from "./spec";

/**
 * The voiceover, as a timing map.
 *
 * The read is written here before it is recorded, because in a seventeen-second
 * ad the voice is the edit: "twenty-five dirhams" has to leave the speaker on
 * the frame the number lands, and that is a decision made in a table, not
 * rescued in a mix.
 *
 * Each line is a separate audio file placed at its own frame rather than one
 * continuous take dropped at zero. A single take drifts - a breath half a second
 * long in the wrong place walks every later line off its picture - and re-cutting
 * it by ear is the one job this file exists to avoid.
 *
 * `atMost` is the slot the line has to fit. A read longer than its slot is not
 * a mixing problem to be sped up; it means losing a word, which is why the
 * script below is already shorter than the brief's.
 */

export type VoiceLine = {
  id: string;
  /** Frame the line starts speaking. */
  from: number;
  /** Frames available before the next thing needs the audience's ear. */
  atMost: number;
  /** What is said. */
  text: string;
  /** Why it is timed here, for whoever re-records it. */
  note: string;
};

export const VOICE: VoiceLine[] = [
  {
    id: "hook",
    from: 6,
    atMost: 63,
    text: "About to pay a hundred and twelve dirhams for dinner?",
    note:
      "Starts on frame 6. Nothing precedes it - no logo, no riser - because the " +
      "first second is the only one a scrolling viewer is guaranteed to give.",
  },
  {
    id: "interrupt",
    from: MARKS.interruptIn + 3,
    atMost: 36,
    text: "Check first.",
    note: "Two words, landing just after the cut. The silence after it is the point.",
  },
  {
    id: "upload",
    from: MARKS.uploadIn + 6,
    atMost: 60,
    text: "Upload your cart to SnipSavor.",
    note: "Over the screenshot entering the app. The picture explains the rest.",
  },
  {
    id: "scan",
    from: MARKS.compareIn + 3,
    atMost: 54,
    text: "We'll check if Keeta has a better deal.",
    note:
      "Deliberately conditional. The product checks; it does not promise a " +
      "saving, and the voice must not either.",
  },
  {
    id: "same",
    from: PAYOFF.holdOld,
    atMost: PAYOFF.saveHit - PAYOFF.holdOld,
    text: "Same dinner. Eighty-seven dirhams.",
    note: "Ends exactly as the saving hits, so the next line starts clean.",
  },
  {
    id: "saved",
    from: PAYOFF.saveHit,
    atMost: 42,
    text: "Twenty-five dirhams, saved.",
    note:
      "The brief's 'That's twenty-five dirhams saved' loses its first word so " +
      "that 'twenty-five' is the first thing heard on the downbeat, rather than " +
      "arriving a third of a second late behind 'that's'.",
  },
  {
    id: "worth",
    from: beat(24) + 6,
    atMost: 36,
    text: "Worth checking.",
    note:
      "Optional, and placed over the reaction rather than the food insert so " +
      "the food gets a beat of its own.",
  },
  {
    id: "cta",
    from: MARKS.ctaIn + 12,
    atMost: 66,
    text: "Before you order, check SnipSavor.",
    note: "Lands with the end card. The sub-line on screen is not spoken.",
  },
];

/** The script as one block, for handing to a voice session. */
export const SCRIPT = VOICE.map((line) => line.text).join("\n");

/**
 * Windows where the music must sit under the voice.
 *
 * Derived from the lines rather than dialled in by hand, so re-timing a line
 * moves its duck with it. A little lead-in and tail keep the duck from chopping
 * the first and last syllable.
 */
export const DUCK_WINDOWS = VOICE.map((line) => ({
  from: line.from - 6,
  to: line.from + line.atMost + 6,
}));
