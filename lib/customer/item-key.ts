let nextItemKey = 0;

/** Local UI identity only. Skip restored keys; no browser crypto is needed. */
export function createItemKey(existing: readonly { key: string }[] = []): string {
  const used = new Set(existing.map((item) => item.key));
  let key: string;
  do {
    key = `item-${++nextItemKey}`;
  } while (used.has(key));
  return key;
}
