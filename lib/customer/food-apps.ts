/**
 * The five apps a cart can come from, and how to get to one.
 *
 * Plain https links, opened in a new tab. That is not a fallback for deep
 * linking - on a phone it IS the deep link: Android App Links and iOS Universal
 * Links hand a verified https URL straight to the installed app, and the web
 * page is what happens when the app is not installed. A talabat:// scheme would
 * only add a way to fail on desktop and in every browser that blocks unknown
 * schemes.
 *
 * Each app carries two marks, and which one a customer sees depends on nothing
 * more than whether the file exists:
 *
 *   `logo`  the real thing - the brand's own square app icon, supplied by the
 *           owner of this product and kept in /public/brands.
 *   `mark`  the letter that stands in if that file ever fails to load, on the
 *           brand's colour. Not a drawing of somebody else's trademark: the
 *           colour is theirs, the letter is ours.
 *
 * The fallback survives the artwork arriving because the thing it guards
 * against is not "we never got the file" - it is a blocked request, a stale
 * cache, a rename - and the answer to all of those is a tile that still says
 * which app it opens.
 *
 * `tile` is sampled from each icon rather than from a brand guideline: the
 * icons are rounded squares on a transparent field, so this colour is what
 * shows through the four corners, and anything else would ring the mark.
 *
 * Kept out of the component because it is data: this file is what the test
 * checks, and what anybody adding a fifth app edits.
 */
export type FoodApp = {
  /** As the brand writes it. Shown to the customer as "Open <name>". */
  name: string;
  /** Where the tile goes. https, always - see the note above. */
  href: string;
  /** Square app icon under /brands. If it fails to load, `mark` covers it. */
  logo: string;
  /** One character, shown on `tile` until `logo` loads. */
  mark: string;
  /** The icon's own background colour, as a Tailwind class. Backs the tile. */
  tile: string;
  /** Ink that reads on `tile`. Only seen if `mark` is showing. */
  ink: string;
};

export const FOOD_APPS: readonly FoodApp[] = [
  {
    name: "Talabat",
    href: "https://www.talabat.com/uae",
    logo: "/brands/talabat.png",
    mark: "t",
    tile: "bg-[#FB5802]",
    ink: "text-white",
  },
  {
    name: "Careem",
    href: "https://www.careem.com/en-AE/food/",
    logo: "/brands/careem.png",
    mark: "C",
    tile: "bg-[#1EBB59]",
    ink: "text-white",
  },
  {
    name: "Deliveroo",
    href: "https://deliveroo.onelink.me/9Aoc/NewHomepageCardAEEN",
    logo: "/brands/deliveroo.png",
    mark: "D",
    tile: "bg-[#02D7C8]",
    ink: "text-white",
  },
  {
    name: "Noon Food",
    href: "https://food.noon.com/uae-en/",
    logo: "/brands/noon-food.png",
    mark: "n",
    tile: "bg-[#FBDF01]",
    ink: "text-ink-900",
  },
  {
    name: "Smiles",
    href: "https://smilesuae.go.link/dBzkD",
    logo: "/brands/smiles.png",
    mark: "S",
    tile: "bg-[#C52A87]",
    ink: "text-white",
  },
] as const;
