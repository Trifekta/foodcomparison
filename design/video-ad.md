# The ads

Two ads live in this repository, both rendered from it.

| | V1 | V2 |
| --- | --- | --- |
| Shape | 1920x1080, 16:9 | 1080x1920, 9:16 |
| Length | 18s | 17.5s |
| For | Site, YouTube, decks | Instagram Reels, TikTok, Stories |
| Reads as | Product film | Performance ad |
| Render | `npm run ad:render` | `npm run ad2:render` |

```bash
npm run ad:studio     # the editor - both compositions are in it
npm run ad2:render    # out/snipsavor-ad-v2.mp4
npm run ad2:still     # a frame, for a thumbnail or a static post
npm run ad:audio      # regenerates the music bed and the sound design
```

V1 is unchanged and still renders. V2 is a separate composition under
`remotion/ad-v2/` and shares V1's fonts and the product's components; neither
imports the other's scenes.

---

## Why V2 exists

V1 explains what SnipSavor does, evenly, in nine two-second beats on a flat
ground. It is a good product film and it would die in a feed, because a feed
does not grant a product film its first two seconds.

V2 is built the other way round:

- **It opens on the problem, not the brand.** A dark room, a bright screen, AED
  112, and a thumb moving towards "Place order". No logo for four seconds.
- **It is cut to music, not scored afterwards.** The track is 120bpm, which at
  30fps is fifteen frames to the beat. Every cut in `spec.ts` is divisible by
  fifteen, and the two that matter - the saving, and the end card - are on bar
  downbeats.
- **It holds the brand back.** Everything before 4.0s is a cold room; everything
  after is cream and gold. The turn lands as relief rather than as decoration.
- **It spends its length where the money is.** Three seconds on the payoff, three
  and a half on the end card, and the first ten seconds move fast.

---

## The beat grid

`remotion/ad-v2/spec.ts` is the edit. Marks are frames; all are on beats.

| Act | In | Out | What |
| --- | --- | --- | --- |
| Hook | 0 | 75 | "About to pay AED 112 for dinner?" |
| Interrupt | 75 | 120 | Screenshot. "Check first." |
| Upload | 120 | 195 | Into SnipSavor; the brand turn |
| Compare | 195 | 255 | Six basket lines matched on eighth notes |
| **Reveal** | 255 | 345 | 112 -> 87 at 285, **save at 300** |
| Human | 345 | 420 | The result read, then the food |
| CTA | 420 | 525 | End card |

Frame 300 is the ad: the saving lands, the loudest accent in the track hits, and
the voiceover says "twenty-five". Changing a beat length moves everything after
it automatically - nothing downstream carries a hard-coded start frame.

---

## Who does what

The division is enforced by where things live, not by discipline.

**Remotion draws anything with a price, a logo, an interface or a word in it.**
The cart, the SnipSavor screens, every figure, the wordmark, the CTA. Figures
come from `spec.ts`, which throws at import time if the cart lines do not total
the headline price or if the saving is not the difference between the two - so
the ad cannot render showing AED 24.98 anywhere.

**Runway supplies anything with a face, a hand, a room or a plate of food in
it.** Three slots in `slots.ts`, none filled. Each has a drawn stand-in so the
ad renders complete and the cut can be approved before a credit is spent.

Never ask a generative model for the interface. Whatever it paints on the glass
is thrown away: `phone.tsx` exports `screenTransform`, which solves the
homography onto four tracked screen corners, and `ScreenComposite`, which
corner-pins the real UI over them.

### The three shots to generate

Prompts are in `slots.ts`, ready to paste. In order of value:

1. **`HOOK`** - the opening. A person seeing what dinner costs. The premise is an
   expression, and this is the shot the ad most needs.
2. **`REACTION`** - 11.5s. The same person, same sofa, same light, quietly
   pleased. Generate it in the same session as HOOK, from the same reference
   frame, or it reads as two different ads.
3. **`FOOD`** - 13.0s, one second. No continuity burden, easiest to get right,
   and the safest place to spend the first credit.

Reject and regenerate any take with: extra or deformed fingers, a warped phone,
different clothes or face between shots, eyes not on the phone, overacting,
readable generated text, floating objects, or motion that could not happen.

To drop a clip in: put it in `public/ad/`, set `src` on the slot, set `trimAfter`
to the beat length. Nothing else changes.

---

## Audio

### Music

`scripts/build_ad_audio.py` synthesises the bed and every effect from
oscillators and noise, standard library only.

That is a licensing decision before it is a creative one. An ad that will run as
paid media cannot carry a track whose commercial terms nobody has read, and the
cheapest way to be certain is to own every sample in it. It also means the bed is
exactly on the grid the picture is cut to rather than nearly on it, and that
re-timing an act and re-running the script keeps them together.

The arrangement follows the acts: sparse and immediate over the hook, a hole
after "Check first.", hats and a pluck motif arriving with the product, a riser
into the reveal, the biggest hit of the track on frame 300, everything pulled out
for the human beat, and a clean resolution under the end card.

### Sound design

Nine effects, placed in `mix.tsx` on frames that already exist in `spec.ts` - the
shutter on the cut, the ticks on the same eighth notes the basket lines match on,
the big impact on the same downbeat the saving lands. Nothing is placed by ear,
so the picture and the audio cannot drift apart.

They are mixed to be felt rather than noticed: every effect sits well under the
voice, and the AED 25 impact is the only one that is meant to be heard as an
event.

### Voiceover - NOT YET RECORDED

**The ad currently renders without speech.** This is the one part of the brief
that is not done, and it is not something the edit can paper over: the ad is
built for a voice and is materially weaker without one.

Everything around it is ready. `vo.ts` holds the script, the exact frame each
line starts on, how long it has, and why it is timed there. `mix.tsx` reads the
same file to duck the music under speech, so the ducking is already correct and
already follows the timing.

To finish it:

1. Record the eight lines in `vo.ts` - the script is also available as `SCRIPT`.
2. Save each as `public/ad/vo/<id>.wav`, named by the line's `id`.
3. Set `AUDIO.voiceDir = "ad/vo"` in `slots.ts`.
4. `npm run ad2:render`.

Each line is placed individually rather than as one continuous take, because a
single take drifts: one breath half a second long in the wrong place walks every
later line off its picture. If a read runs longer than its `atMost`, lose a word
rather than speeding the delivery - the script is already shorter than the brief's
for that reason.

Direction: 20-35, natural conversational English, clear international accent,
energetic and confident with a little attitude, not a salesperson and not an
over-excited influencer. No synthetic read should ship, even temporarily.

### Mix

Voice, then music, then effects. The music sits at 0.78 with no voice and drops
to 0.62 once there is one, ducking to 0.30 under each line with a six-frame fall
and a ten-frame recovery - smooth, not a gate. Rendered output peaks at
-2.0 dBFS with no clipped samples, and is balanced for a phone speaker: nothing
below 32Hz survives one, so it is rolled off rather than left to eat headroom.

---

## Before this runs anywhere

- **The saving claim.** One basket, AED 112 against AED 87. Whatever ships must be
  a real comparison somebody can produce, with whatever qualifier legal asks for.
  The in-app result card says "You could save" - the product's own hedge - and
  should stay hedged.
- **Naming Keeta.** V2 names Keeta on screen and in the voiceover. That is
  comparative advertising and in the UAE it wants sign-off and substantiation for
  the basket shown. V1 deliberately did not name an app; V2 does because the
  brief calls for it. `COMPARISON.app` in `spec.ts` is the one edit if that
  changes. The "before" app is left generic on purpose - the claim is about
  price, and dressing that screen as a named competitor adds a passing-off
  problem for nothing in return.
- **What SnipSavor is.** It does not cook, deliver, or place an order. Nothing in
  the ad says order, get, or delivered; every line is a form of "check before you
  pay". Keep it that way.
- **Remotion's licence.** Free for individuals and companies under four people;
  larger companies need a paid company licence.

---

## Notes for whoever renders it next

- Rendering downloads a Chrome Headless Shell on first run. Behind a restrictive
  network, point it at an existing browser:
  `npm run ad2:render -- --browser-executable=/path/to/chrome`.
- `npx remotion versions` warns that zod is newer than the version Remotion pins.
  It only affects `@remotion/zod-types`, which neither ad uses, and zod is a core
  app dependency - do not downgrade it for the video.
- Fonts are self-hosted in `public/fonts/`, so a render works offline and in CI.
  A render that cannot reach Google still produces a video, just one silently set
  in a system sans.
- `screenTransform` is verified against its own corner correspondences to 1e-13;
  if a composite ever looks skewed, the tracked corners are wrong, not the maths.
- The generated audio lives in `public/ad/` because that is where `staticFile()`
  reads from, which means about 1.9MB of it is also served by the app and
  deployed with it. Nothing requests it, so nobody downloads it, but it is dead
  weight in the bundle - the same build step the food renders want (see the
  weight note in `design/food-assets.md`) should emit compressed copies of these
  too, or move the ad's media to its own public directory via
  `Config.setPublicDir()` once nothing else in `public/` is shared with it.

---

## V1 reference

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
