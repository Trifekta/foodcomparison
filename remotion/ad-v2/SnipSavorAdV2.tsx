import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { CAVEAT_FAMILY, JAKARTA_FAMILY } from "../ad/fonts";
import { BeatFlash, FilmLook } from "./film";
import { MARKS, beat, span } from "./spec";
import { Mix } from "./mix";
import { Hook } from "./scenes/Hook";
import { Interrupt } from "./scenes/Interrupt";
import { Upload } from "./scenes/Upload";
import { Compare } from "./scenes/Compare";
import { Reveal } from "./scenes/Reveal";
import { Human } from "./scenes/Human";
import { Cta } from "./scenes/Cta";

/**
 * SnipSavor V2 - a vertical performance ad.
 *
 * V1 was a product film: nine even beats, one move, flat ground, 16:9. It is a
 * good explanation of what SnipSavor does and it would die in a feed, because a
 * feed does not grant a product film its first two seconds.
 *
 * This one is built the other way round. It opens on a number in a dark room
 * before it has said who it is, it is cut to a 120bpm grid so the edit and the
 * track are the same decision, it holds its brand back for four seconds so the
 * turn into cream and gold lands as relief, and it spends a third of its length
 * on three seconds of payoff and three and a half of end card.
 *
 * The division of labour the brief asks for is enforced structurally rather than
 * by discipline: anything with a price, a logo, an interface or a word in it is
 * drawn here, in React, from the product's own components and constants;
 * anything with a face, a hand, a room or a plate of food in it is a slot in
 * slots.ts that generated footage drops into. Nothing that has to be accurate is
 * ever left to a model that cannot spell.
 */
export function SnipSavorAdV2() {
  return (
    <AbsoluteFill
      style={
        {
          "--font-jakarta": JAKARTA_FAMILY,
          "--font-caveat": CAVEAT_FAMILY,
          fontFamily: "var(--font-sans)",
          background: "#08090e",
        } as React.CSSProperties
      }
    >
      <Series>
        <Series.Sequence durationInFrames={span("hookIn", "interruptIn")}>
          <Hook />
        </Series.Sequence>
        <Series.Sequence durationInFrames={span("interruptIn", "uploadIn")}>
          <Interrupt />
        </Series.Sequence>
        <Series.Sequence durationInFrames={span("uploadIn", "compareIn")}>
          <Upload />
        </Series.Sequence>
        <Series.Sequence durationInFrames={span("compareIn", "revealIn")}>
          <Compare />
        </Series.Sequence>
        <Series.Sequence durationInFrames={span("revealIn", "humanIn")}>
          <Reveal />
        </Series.Sequence>
        <Series.Sequence durationInFrames={span("humanIn", "ctaIn")}>
          <Human />
        </Series.Sequence>
        <Series.Sequence durationInFrames={span("ctaIn", "end")}>
          <Cta />
        </Series.Sequence>
      </Series>

      {/* Two cuts get a frame of lift rather than a transition: the one into the
          product, and the hard cut to the food. */}
      <BeatFlash at={MARKS.uploadIn} strength={0.34} />
      <BeatFlash at={beat(26)} strength={0.26} />

      {/* Grain and falloff over everything, including the drawn scenes, so the
          built shots and any footage that lands sit in the same picture. */}
      <FilmLook grain={0.075} vignette={0.5} />

      <Mix />
    </AbsoluteFill>
  );
}
