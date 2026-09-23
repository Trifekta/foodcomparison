"use client";

import { useId, useRef } from "react";
import { Minus, Plus, Store, Trash2, UtensilsCrossed } from "lucide-react";
import {
  CURRENCY,
  MAX_CART_ITEMS,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
} from "@/lib/constants";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils/cn";
import { createItemKey } from "@/lib/customer/item-key";
import type { CartItemDraft, ExtractionStatus, ReadTotals } from "./types";

interface BasketEditorProps {
  restaurantName: string;
  items: CartItemDraft[];
  restaurantError?: string;
  extractionStatus: ExtractionStatus;
  /** Totals read off the screenshots, shown back so they can be checked. */
  readTotals: ReadTotals | null;
  /** Whether the payment screenshot is where those figures came from. */
  totalsFromCheckout: boolean;
  onRestaurantNameChange: (value: string) => void;
  onItemsChange: (items: CartItemDraft[]) => void;
}

/**
 * The basket, as read off the screenshot and as the customer may correct it.
 *
 * This was a screen of its own. It is the same fields, the same rules and the
 * same markup, now folded into the confirm step behind a summary - so an
 * extraction that got everything right costs nobody a scroll, and one that did
 * not is still entirely correctable by the person holding the phone.
 *
 * The restaurant is required: nobody can rebuild the order without it, which is
 * why the panel holding this opens itself whenever the field is empty. The
 * items stay optional, and blank rows are dropped rather than flagged, because
 * the cart screenshot remains the source of truth.
 */
export function BasketEditor({
  restaurantName,
  items,
  restaurantError,
  extractionStatus,
  readTotals,
  totalsFromCheckout,
  onRestaurantNameChange,
  onItemsChange,
}: BasketEditorProps) {
  const restaurantId = useId();
  const itemFieldId = useId();
  // Focuses the row we just added, so adding several items stays keyboard-only.
  const pendingFocus = useRef<string | null>(null);

  const full = items.length >= MAX_CART_ITEMS;
  const reading = extractionStatus === "reading";

  const totalRows = readTotals
    ? ([
        ["Subtotal", readTotals.subtotal],
        ["Delivery", readTotals.deliveryFee],
        ["Service", readTotals.serviceFee],
        ["Discount", readTotals.discount],
      ].filter(([, value]) => value !== "") as Array<[string, string]>)
    : [];

  const addItem = () => {
    if (full) return;
    const key = createItemKey(items);
    pendingFocus.current = key;
    onItemsChange([...items, { key, name: "", quantity: 1, linePrice: null, proposed: null }]);
  };

  const updateItem = (key: string, patch: Partial<Omit<CartItemDraft, "key" | "proposed">>) => {
    onItemsChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const removeItem = (key: string) => {
    onItemsChange(items.filter((item) => item.key !== key));
  };

  const setQuantity = (item: CartItemDraft, next: number) => {
    updateItem(item.key, { quantity: Math.min(MAX_ITEM_QUANTITY, Math.max(1, next)) });
  };

  /** Keeps the field to digits and at most two decimals while it is typed. */
  const setPrice = (item: CartItemDraft, raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, "");
    if (cleaned !== "" && !/^\d{0,7}(\.\d{0,2})?$/.test(cleaned)) return;
    // Touching the field answers the question the flag was asking.
    updateItem(item.key, {
      linePrice: cleaned === "" ? null : cleaned,
      priceUncertain: false,
    });
  };

  return (
    <div className="space-y-5">
      {/* Restaurant - required */}
      <div className="rounded-3xl bg-linear-to-b from-brand-100 to-beige p-3.5">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-300"
          >
            <Store className="h-4.5 w-4.5 text-ink-900" />
          </span>
          <label htmlFor={restaurantId} className="text-[1.02rem] font-extrabold text-ink-900">
            Restaurant name
          </label>
        </div>
        <input
          id={restaurantId}
          type="text"
          autoComplete="off"
          enterKeyHint="next"
          maxLength={MAX_RESTAURANT_NAME_LENGTH}
          value={restaurantName}
          onChange={(event) => onRestaurantNameChange(event.target.value)}
          aria-describedby={restaurantError ? `${restaurantId}-error` : `${restaurantId}-hint`}
          aria-invalid={restaurantError ? true : undefined}
          className={cn(
            "min-h-14 w-full rounded-2xl bg-white px-4 text-base font-semibold text-ink-900 ring-1 placeholder:font-normal placeholder:text-slate-400",
            restaurantError ? "ring-rose-400" : "ring-ink-200",
          )}
          placeholder={reading ? "Reading…" : "e.g. Al Safadi"}
        />
        {restaurantError ? (
          <FieldError id={`${restaurantId}-error`} message={restaurantError} />
        ) : (
          <p id={`${restaurantId}-hint`} className="mt-2 text-sm text-ink-600">
            It&apos;s at the top of your cart screenshot.
          </p>
        )}
      </div>

      {/* Items - optional */}
      <section aria-labelledby={`${itemFieldId}-legend`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 id={`${itemFieldId}-legend`} className="text-[1.02rem] font-extrabold text-ink-900">
            Your items
          </h3>
          <span className="rounded-full bg-chip-green-bg px-2.5 py-0.5 text-[0.72rem] font-bold text-chip-green-fg">
            Optional
          </span>
          {items.length > 0 ? (
            <span className="ml-auto text-[0.8rem] font-semibold text-slate-500">
              {items.length} of {MAX_CART_ITEMS}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Adding them helps us match your basket faster. We check the rest against your screenshot.
        </p>

        {items.length > 0 ? (
          <ul className="mt-3 space-y-2.5">
            {items.map((item, index) => (
              <li
                key={item.key}
                className="rounded-2xl bg-white p-3 ring-1 ring-ink-200 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ink-900"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-50"
                  >
                    <UtensilsCrossed className="h-4 w-4 text-slate-600" />
                  </span>
                  <input
                    type="text"
                    autoComplete="off"
                    enterKeyHint="done"
                    maxLength={MAX_ITEM_NAME_LENGTH}
                    value={item.name}
                    ref={(node) => {
                      if (node && pendingFocus.current === item.key) {
                        pendingFocus.current = null;
                        node.focus();
                      }
                    }}
                    onChange={(event) => updateItem(item.key, { name: event.target.value })}
                    aria-label={`Item ${index + 1} name`}
                    className="min-h-11 w-full min-w-0 flex-1 rounded-xl bg-transparent pl-1 pr-2 text-[0.98rem] font-semibold text-ink-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                    placeholder="Item name"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Remove item ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-ink-100 pt-2">
                  <span className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(item, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 text-ink-900 hover:bg-ink-100 disabled:opacity-40"
                      aria-label={`Decrease quantity of item ${index + 1}`}
                    >
                      <Minus aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
                    </button>
                    <span className="min-w-9 text-center text-[1rem] font-extrabold tabular-nums text-ink-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item, item.quantity + 1)}
                      disabled={item.quantity >= MAX_ITEM_QUANTITY}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-300 text-ink-900 hover:bg-brand-400 disabled:opacity-40"
                      aria-label={`Increase quantity of item ${index + 1}`}
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </span>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1",
                      item.priceUncertain ? "bg-amber-50 ring-1 ring-amber-400" : "bg-ink-50",
                    )}
                  >
                    {item.priceUncertain ? (
                      <span className="text-[0.62rem] font-extrabold uppercase tracking-wide text-amber-700">
                        check
                      </span>
                    ) : null}
                    <span aria-hidden="true" className="text-[0.78rem] font-bold text-ink-400">
                      {CURRENCY}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={item.linePrice ?? ""}
                      onChange={(event) => setPrice(item, event.target.value)}
                      aria-label={
                        item.priceUncertain
                          ? `Price shown for item ${index + 1} - please check this one`
                          : `Price shown for item ${index + 1}`
                      }
                      className="min-h-9 w-16 bg-transparent text-right text-[0.95rem] font-extrabold tabular-nums text-ink-900 placeholder:font-medium placeholder:text-ink-300 focus:outline-none"
                      placeholder="—"
                    />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={addItem}
          disabled={full}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-white/60 text-[0.95rem] font-bold text-ink-800 hover:border-brand-400 hover:bg-brand-100/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
          {items.length === 0 ? "Add an item" : "Add another item"}
        </button>
        {full ? (
          <p className="mt-2 text-center text-sm text-slate-500">
            That&apos;s the most we need — your screenshot covers the rest.
          </p>
        ) : null}

        {/* What the screenshot said the money was. Shown, not stored: the total
            that drives the comparison is the one in the field below this
            panel, which they can see and change. */}
        {totalRows.length > 0 || readTotals?.finalTotal ? (
          <dl className="mt-4 rounded-2xl bg-ink-50 px-4 py-3 text-[0.9rem]">
            <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-wide text-slate-500">
              {totalsFromCheckout ? "From your checkout screenshot" : "From your screenshot"}
            </p>
            {totalRows.map(([label, value]) => (
              <div key={label} className="flex justify-between py-1 text-slate-600">
                <dt>{label}</dt>
                <dd className="tabular-nums">
                  {label === "Discount" ? "-" : ""}
                  {CURRENCY} {value}
                </dd>
              </div>
            ))}
            {readTotals?.finalTotal ? (
              <div className="mt-1 flex justify-between border-t border-ink-200 pt-2 font-extrabold text-ink-900">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {CURRENCY} {readTotals.finalTotal}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>
    </div>
  );
}
