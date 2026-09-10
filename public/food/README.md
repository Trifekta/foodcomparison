# Food imagery

Drop the AI-generated food renders here as **transparent PNGs**, then the
vector illustrations in `components/customer/FoodArt.tsx` get swapped out for
them.

Transparency matters: every one of these sits on a coloured or gradient panel,
so an image with a baked-in background will show as a visible rectangle.

## Files needed

| Filename | Used on | Contents |
| --- | --- | --- |
| `spread.png` | Landing hero, Upload hero | The group shot: fries, burger, pizza slice, grain bowl, wrap |
| `celebration.png` | Confirmation | Fries, burger, bowl and the kraft paper bag |
| `bag-cluster.png` | Review — price challenge card | Delivery bag with fries, drink and burger |
| `bowl.png` | Location — heading vignette | Single grain bowl |
| `burger.png` | Location — reassurance strip | Single burger |
| `cart-doc.png` | Upload — slot 1 empty state | Order document with a food mark |
| `receipt.png` | Upload — slot 2 empty state | Receipt marked AED |

## Specs

- **Format:** PNG with alpha. Trim the canvas to the artwork, no padding.
- **Size:** roughly 3x the display size, so they stay sharp on phones.
  - `spread.png`, `celebration.png`, `bag-cluster.png`: about 1200px wide
  - `bowl.png`, `burger.png`, `cart-doc.png`, `receipt.png`: about 600px tall
- **Weight:** keep each under ~250 KB. Run them through a PNG optimiser if
  needed — they are bundled and served from the edge on every page load.

## One thing to check before adding

The delivery bag in the reference carries a competitor's logo. This app
reproduces no third-party mark anywhere else, so `bag-cluster.png` should use a
plain, unbranded bag. Same for any packaging in `celebration.png`.
