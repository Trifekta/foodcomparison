# FindFood UAE visual assets

Standalone AI-generated renders, transparent PNG, no UI chrome in the pixels.

- spread.png — main food group for landing/upload hero
- celebration.png — alternate food group for confirmation hero
- bag-cluster.png — Keeta price-card cluster; its warm panel background is intentionally retained because the yellow bag edge blends into the panel
- bowl.png — location-screen food bowl
- burger.png — location promo burger
- cart-doc.png — upload-state cart/order document icon
- receipt.png — checkout receipt upload icon

Use the supplied PNG assets directly. Do not redraw, vectorize, or substitute them. Reference screens are included in reference-screens/.

## Rule: assets carry food only

The PNGs here are food and illustration. Everything else is native HTML/CSS,
layered around them in the components:

| Element | Where it lives |
| --- | --- |
| Camera badge, sparks, "Tap to upload" label | `components/forms/ImageUpload.tsx` |
| "Same Food / Lower Prices" and every handwritten line | `components/customer/Motifs.tsx` |
| Checkmarks, Required / Optional / Added pills, status pills | `ImageUpload.tsx`, `StepReview.tsx` |
| Confirmation tick badge | `components/customer/FoodArt.tsx` |
| Panel backgrounds and gradients | the screen components |

So an asset should arrive on a transparent background with no badge, tick,
label or caption in its pixels. Anything baked in ends up duplicated, because
the component draws its own.

## Weight

The seven renders total about 10 MB, and the heroes sit above the fold. They are
served at their native resolution, which is well above what any slot displays -
`spread.png` is 2172px wide for a slot that renders around 220px. Nothing about
the artwork needs to change to fix that: a build step emitting correctly-sized
copies would cut the payload by roughly an order of magnitude while keeping
these files as the source of truth.
