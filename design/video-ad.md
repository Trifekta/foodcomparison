# The launch ad

An eighteen-second product ad, rendered from this repository.

```bash
npm run ad:studio    # the editor, with a scrubbable timeline
npm run ad:render    # out/snipsavor-ad.mp4
npm run ad:still     # out/snipsavor-frame.png, for a thumbnail or a still post
```

It is built with [Remotion](https://remotion.dev), which renders React to video.
Everything lives under `remotion/` and nothing in `app/` imports it, so the ad
is never in the app bundle.

---

## Why it is code and not a video file

The ad shows the product. That means a wordmark, a mark, brand gold, Plus Jakarta
Sans, and the exact sentences that appear on the screens it sends people to. All
of those already exist in this repository and all of them change.

So the ad imports them rather than copying them:

| On screen | Comes from |
| --- | --- |
| The wordmark in the last beat | `components/customer/Wordmark.tsx`, the shipping component |
| The mark in beat three | `public/icons/icon-512.png`, rendered from `app/icon.svg` by `npm run icons` |
| Gold, green, the warm ground, the marker highlight | `app/globals.css`, imported whole |
| Plus Jakarta Sans and Caveat | `public/fonts/`, the same faces `app/layout.tsx` loads |
| "Upload your cart", "One screenshot is all we need.", "You could save" | already on the screens, quoted in `remotion/ad/spec.ts` |
| The food | `public/food/spread.png`, `cart-doc.png` |

Change the gold in `globals.css` and re-run `npm run ad:render`: the ad is gold
in the new sense. That is the whole argument for this approach. A designer's
`.aep` file is a photograph of the brand on the day it was exported.

The trade is that motion which is trivial in After Effects - a squash, a
hand-eased overshoot - is fiddly here. This ad is deliberately built from one
move (arrive on a spring, sit still, cut) so it never needs that.

---

## The nine beats

`remotion/ad/spec.ts` holds the timing. Durations are frames at 30fps, and the
composition's length is their sum, so lengthening a beat never means
recalculating the eight after it.

| # | Beat | Frames | Scene |
| --- | --- | --- | --- |
| 1 | "8:41 PM" - the moment before checkout | 60 | `Craving.tsx` |
| 2 | The one photographic shot | 60 | `BRoll.tsx` |
| 3 | The mark, alone, in its construction circles | 60 | `IconBuild.tsx` |
| 4 | A screenshot falls into the crop frame | 60 | `Upload.tsx` |
| 5 | The basket rebuilt, line by line | 60 | `Rebuild.tsx` |
| 6 | Two totals, side by side | 45 | `Compare.tsx` |
| 7 | **The number.** Held longest on purpose | 90 | `Savings.tsx` |
| 8 | The notification that brings them back | 45 | `Notification.tsx` |
| 9 | Wordmark and the promise | 60 | `Lockup.tsx` |

---

## Generated footage

Two shots in the ad are photographic, and neither can be drawn. They are slots
in `remotion/ad/slots.ts`, and **the ad renders complete without them** - each
slot falls back to an asset already in `public/`. Approve the cut first, then
spend money on footage.

To drop a clip in: put the file in `public/ad/`, set `src` on the slot.

```ts
export const BROLL: FootageSlot = {
  src: "ad/broll-pan.mp4",   // was null
  trimAfter: 60,             // keep two seconds
  fallback: "food/spread.png",
  ...
};
```

H.264 in an `.mp4`, 1920x1080. `trimAfter` cuts a generated clip to the beat
rather than letting five seconds stretch a two-second scene.

### What to ask Runway for

Generative video is good at food and light and bad at anything with an edge or a
letter in it. Keep every prompt to one continuous shot with no text, no
interface, no logo and no hands, and let the composition carry the rest.

**`BROLL` - the hero shot (beat 2).** Gen-4, image-to-video, 1920x1080.

> Slow push in on a Middle Eastern delivery spread on a warm wooden table -
> shawarma, mezze, a grill platter. Gentle steam rising. Shallow depth of field,
> warm evening key light from the left, muted cream background. Locked-off camera
> with a very slow dolly in. No hands, no text, no packaging logos.

Seed it with `public/food/spread.png` as the reference image so the generated
food shares the palette of the food elsewhere in the product.

**`SKYLINE` - optional, behind the lockup (beat 9).**

> Dubai skyline at blue hour, very slow lateral drift, soft focus, warm window
> lights. No recognisable branding, no vehicle logos, no text.

Generate three or four of each and pick one. Reject any take with drifting
geometry or a smeared edge - it will be the thing a viewer's eye lands on.

### What not to ask it for

Do not generate the interface beats. Every attempt produces warped text, a
plausible-looking app that is not this one, and a wordmark that is nearly the
wordmark. Those beats are 4, 5, 6, 7, 8 and 9, and they are code for exactly
that reason.

---

## Music

`SOUNDTRACK` in `slots.ts` is null and the render is silent. That is deliberate:
a silent render is an obvious gap, where a render carrying a track nobody holds a
licence for is an invisible liability. Drop a licensed file in `public/ad/` and
name it there.

---

## Before this ad runs anywhere

- **The saving claim.** `BASKET` in `spec.ts` is one basket: AED 112 against AED
  87. Whatever ships has to be a real comparison somebody can produce, and the
  ad should carry whatever qualifier legal asks for. The lead line is the
  product's own hedge - "You could save", not "You save" - and it should stay
  hedged.
- **The column labels.** `COLUMNS` says "The app you're on" and "Same basket,
  another app" rather than naming apps. Naming a competitor in a side-by-side
  price claim is comparative advertising and wants sign-off and substantiation
  in the UAE. The product names the app it rebuilt on because that is a private
  result for one customer; a public ad is a different thing. It is one edit when
  somebody has signed it off.
- **Remotion's licence.** Free for individuals and companies under four people;
  larger companies need a paid company licence. See remotion.dev/license.

---

## Notes for whoever renders it next

- Rendering downloads a Chrome Headless Shell on first run. Behind a restrictive
  network, point it at an existing browser:
  `npm run ad:render -- --browser-executable=/path/to/chrome`.
- `npx remotion versions` warns that zod is newer than the version Remotion
  pins. It is only relevant to `@remotion/zod-types`, which this ad does not
  use, and zod is a core app dependency - do not downgrade it for the video.
- Fonts are self-hosted in `public/fonts/` rather than fetched from Google at
  render time, so a render works offline and in CI. A render that silently
  substitutes a system sans still produces a video, just a wrong one.
