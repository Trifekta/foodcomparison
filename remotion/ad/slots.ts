/**
 * The places generated footage and music drop into the ad.
 *
 * The ad is built so it renders today, complete, with nothing generated: every
 * slot below is null and each one falls back to an asset already in the repo.
 * That matters because the cut has to be approvable before anybody spends money
 * on footage - you watch the eighteen seconds, argue about the timing, and only
 * then commission the two shots that are actually photographic.
 *
 * To drop footage in: put the file in public/ad/ and set the path here,
 * relative to public/. Nothing else changes.
 *
 *   broll: { src: "ad/broll-pan.mp4", ... }
 *
 * Video wants H.264 in an .mp4 at 1920x1080. Generated clips arrive at whatever
 * length the model felt like; `trimAfter` cuts them to the beat rather than
 * letting a five-second clip stretch a two-second scene.
 */

export type FootageSlot = {
  /** Path under public/, or null to use the still fallback. */
  src: string | null;
  /** Frames to skip from the head of the clip. */
  trimBefore?: number;
  /** Frames to keep. Leave undefined to play to the beat's end. */
  trimAfter?: number;
  /** Still image under public/ used until the footage lands. */
  fallback: string;
  /** What the shot has to show, for whoever generates it. */
  brief: string;
};

/**
 * The hero shot. The reference ad spends its entire photographic budget on one
 * card like this one and carries the rest on typography, which is the reason it
 * looks expensive.
 */
export const BROLL: FootageSlot = {
  src: null,
  fallback: "food/spread.png",
  brief:
    "Slow push in on a Middle Eastern delivery spread on a warm table - " +
    "shawarma, mezze, grill. Steam rising. Shallow depth of field, warm " +
    "evening key light, no hands, no text, no logos.",
};

/**
 * The closing shot behind the lockup. Optional - the lockup reads fine on the
 * flat ground, which is how the reference ends.
 */
export const SKYLINE: FootageSlot = {
  src: null,
  fallback: "art/skyline.png",
  brief:
    "Dubai skyline at blue hour, very slow drift, soft focus, no recognisable " +
    "branding or vehicle logos.",
};

/**
 * Music.
 *
 * Left null on purpose. The ad must not ship with a track nobody holds a
 * licence for, and a silent render is an obvious gap where a wrong-licence
 * render is an invisible liability. Drop a licensed file in public/ad/ and name
 * it here.
 */
export const SOUNDTRACK: { src: string | null; volume: number } = {
  src: null,
  volume: 0.55,
};
