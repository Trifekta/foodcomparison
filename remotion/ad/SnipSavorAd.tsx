import React from "react";
import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { CAVEAT_FAMILY, JAKARTA_FAMILY } from "./fonts";
import { BEATS } from "./spec";
import { SOUNDTRACK } from "./slots";
import { Craving } from "./scenes/Craving";
import { BRoll } from "./scenes/BRoll";
import { IconBuild } from "./scenes/IconBuild";
import { Upload } from "./scenes/Upload";
import { Rebuild } from "./scenes/Rebuild";
import { Compare } from "./scenes/Compare";
import { Savings } from "./scenes/Savings";
import { Notification } from "./scenes/Notification";
import { Lockup } from "./scenes/Lockup";

/**
 * The eighteen-second launch ad.
 *
 * Nine beats, cut hard, no transitions between them. `Series` lays them out
 * back to back from the durations in spec.ts, so changing a beat's length never
 * means recalculating the start frame of the eight scenes after it.
 *
 * The font variables are published here under the exact names globals.css
 * expects, so every utility class and the script/marker utilities resolve the
 * way they do in the browser. `fontFamily` is set on the same element because a
 * var() only resolves against the element it is written on, and body inherits a
 * computed font-family settled before these properties existed.
 */
export function SnipSavorAd() {
  return (
    <AbsoluteFill
      className="bg-canvas"
      style={
        {
          "--font-jakarta": JAKARTA_FAMILY,
          "--font-caveat": CAVEAT_FAMILY,
          fontFamily: "var(--font-sans)",
        } as React.CSSProperties
      }
    >
      <Series>
        <Series.Sequence durationInFrames={BEATS.craving}>
          <Craving />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BEATS.broll}>
          <BRoll />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BEATS.icon}>
          <IconBuild />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BEATS.upload}>
          <Upload />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BEATS.rebuild}>
          <Rebuild />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BEATS.compare}>
          <Compare />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BEATS.savings}>
          <Savings />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BEATS.notification}>
          <Notification />
        </Series.Sequence>
        <Series.Sequence durationInFrames={BEATS.lockup}>
          <Lockup />
        </Series.Sequence>
      </Series>

      {SOUNDTRACK.src ? (
        <Audio src={staticFile(SOUNDTRACK.src)} volume={SOUNDTRACK.volume} />
      ) : null}
    </AbsoluteFill>
  );
}
