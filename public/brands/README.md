# Food app icons

Drop the four delivery apps' own square app icons in here and the tiles on the
upload step start showing real logos. Nothing else has to change.

| File | App | Falls back to |
| --- | --- | --- |
| `talabat.png` | Talabat | orange tile, `t` |
| `careem.png` | Careem | green tile, `C` |
| `deliveroo.png` | Deliveroo | teal tile, `D` |
| `noon-food.png` | Noon Food | yellow tile, `n` |

The filenames are the `logo` paths in `lib/customer/food-apps.ts` — use a
different name or format (an `.svg` is fine) and change that file to match.

## What the file has to be

- **Square**, and the icon as the store shows it: the tile crops with
  `object-cover`, so a wordmark on a wide canvas loses its ends.
- **96×96 or larger.** It renders at 24 CSS px, so 96 covers a 4× screen.
- **PNG or SVG.** Transparent PNGs are fine; the brand colour stays painted
  underneath.
- **Small.** These are 24px tiles — a few KB each, not the megabyte PNGs in
  `/public/food`.

## Where they come from

Nobody should draw these. Take them from the brand's own press or partner kit,
and only if this product has the right to use them — a link to a shop is
usually nominative use, but that is a decision for a person, not a default.
Until such a file is in hand, the letter tiles are deliberate: an approximation
of somebody else's trademark is worse than a tile that plainly is not one.

That is why this folder ships with no artwork, and why every tile works anyway.
