import { CART, COMPARISON } from "./spec";

/**
 * The cart, taken apart.
 *
 * Between 4.5 and 7.5 seconds the compressed card stops being a card and
 * becomes four objects lying in the frame: who it is from, what is in it, what
 * it costs to bring, and what it comes to. The brackets then move between them
 * and verify them one at a time.
 *
 * The rects live here rather than in the layer because the bracket path reads
 * them too. That is the only way the brackets land exactly on the thing they
 * are checking instead of near it, and it means moving an element moves its
 * bracket stop with it.
 */

export type Group = {
  id: string;
  /** Where it comes to rest after the card comes apart. */
  rect: { x: number; y: number; w: number; h: number };
  /** Frame the brackets arrive on it. */
  visitAt: number;
};

export const GROUPS: Group[] = [
  { id: "restaurant", rect: { x: 96, y: 596, w: 540, h: 152 }, visitAt: 146 },
  { id: "items", rect: { x: 132, y: 812, w: 812, h: 432 }, visitAt: 162 },
  { id: "fees", rect: { x: 96, y: 1308, w: 588, h: 212 }, visitAt: 183 },
  { id: "total", rect: { x: 404, y: 1580, w: 576, h: 176 }, visitAt: 196 },
];

export const byId = (id: string) => GROUPS.find((g) => g.id === id)!;

/** Everything at once, for the comparison sweep. */
export const ALL_RECT = { x: 74, y: 566, w: 932, h: 1222 };

/** The item lines, and the fee lines, split the way the groups are. */
export const ITEM_LINES = CART.lines.slice(0, 4);
export const FEE_LINES = CART.lines.slice(4);
export const ITEM_KEETA = COMPARISON.lines.slice(0, 4);
export const FEE_KEETA = COMPARISON.lines.slice(4);
