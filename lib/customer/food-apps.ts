/**
 * The four apps a cart can come from, and how to get to one.
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
 *   `logo`  the real thing - the brand's own square app icon, dropped into
 *           /public/brands by somebody who has the right to use it. See the
 *           README there for what the file has to be.
 *   `mark`  the letter that stands in when that file is absent, on the brand's
 *           colour. Not a drawing of somebody else's trademark: the colour is
 *           theirs, the letter is ours.
 *
 * So this list is complete and correct with an empty /public/brands, and gets
 * better - without a code change - the moment artwork lands. No tile is ever
 * blank, and no approximation of a logo is ever committed here.
 *
 * Kept out of the component because it is data: this file is what the test
 * checks, and what anybody adding a fifth app edits.
 */
export type FoodApp = {
  /** As the brand writes it. Shown to the customer as "Open <name>". */
  name: string;
  /** Where the tile goes. https, always - see the note above. */
  href: string;
  /** Square app icon under /brands. May not exist yet; `mark` covers that. */
  logo: string;
  /** One character, shown on `tile` until `logo` loads. */
  mark: string;
  /** Brand colour, as a Tailwind class. Backs the tile either way. */
  tile: string;
  /** Ink that reads on `tile`. Only seen while `mark` is showing. */
  ink: string;
};

export const FOOD_APPS: readonly FoodApp[] = [
  {
    name: "Talabat",
    href: "https://www.talabat.com/uae",
    logo: "/brands/talabat.png",
    mark: "t",
    tile: "bg-[#FF5A00]",
    ink: "text-white",
  },
  {
    name: "Careem",
    href: "https://www.careem.com/en-AE/food/",
    logo: "/brands/careem.png",
    mark: "C",
    tile: "bg-[#3EB55B]",
    ink: "text-white",
  },
  {
    name: "Deliveroo",
    href: "https://deliveroo.onelink.me/9Aoc/NewHomepageCardAEEN",
    logo: "/brands/deliveroo.png",
    mark: "D",
    tile: "bg-[#00CCBC]",
    ink: "text-white",
  },
  {
    name: "Noon Food",
    href: "https://food.noon.com/uae-en/",
    logo: "/brands/noon-food.png",
    mark: "n",
    tile: "bg-[#FEEE00]",
    ink: "text-ink-900",
  },
] as const;
