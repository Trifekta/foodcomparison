/** Tiny class-name joiner. Avoids pulling in another dependency for this. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
