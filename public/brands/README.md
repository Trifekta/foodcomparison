# Food app icons

The square app icons behind the four tiles on the upload step. They are
rendered by `components/customer/wizard/FoodAppLinks.tsx`, and the paths live
in `lib/customer/food-apps.ts`.

| File | App | Falls back to |
| --- | --- | --- |
| `talabat.png` | Talabat | `#FB5802` tile, `t` |
| `careem.png` | Careem | `#1EBB59` tile, `C` |
| `deliveroo.png` | Deliveroo | `#02D7C8` tile, `D` |
| `noon-food.png` | Noon Food | `#FBDF01` tile, `n` |

Nothing here is drawn by us. These are the brands' own marks, supplied by the
owner of this product, who is responsible for the right to use them — linking
to a shop is usually nominative use, but that is a decision for a person, not
a default. The letter fallbacks stay in the code for the same reason they
existed before any artwork arrived: an approximation of somebody else's
trademark would be worse than a tile that plainly is not one.

## Replacing one

- **Square**, and the icon as the store shows it: the tile crops with
  `object-cover`, so a wordmark on a wide canvas loses its ends.
- **192×192**, which is 8× the 24 CSS px it renders at. Crop to the mark
  itself: no white margin, and a transparent field outside the rounded
  corners so the tile colour shows through rather than a white sliver.
- **A palette PNG.** These are two-colour marks, so 32 colours is lossless to
  the eye and keeps each file under 6 KB. An `.svg` is fine too — change the
  path in `lib/customer/food-apps.ts` to match.
- **Re-sample `tile`** in that file from the new icon's own background, since
  that colour is what shows in the corners.

`tests/food-apps.test.ts` checks that every app still points at a file that
exists here.
