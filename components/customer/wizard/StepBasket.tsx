"use client";

import { useId, useRef } from "react";
import { Minus, Plus, Store, Trash2, UtensilsCrossed } from "lucide-react";
import {
  MAX_CART_ITEMS,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
} from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble, ScriptNote } from "@/components/customer/Motifs";
import { cn } from "@/lib/utils/cn";
import type { CartItemDraft } from "./types";

interface StepBasketProps {
  restaurantName: string;
  items: CartItemDraft[];
  restaurantError?: string;
  onRestaurantNameChange: (value: string) => void;
  onItemsChange: (items: CartItemDraft[]) => void;
  onContinue: () => void;
}

/**
 * Confirm the basket.
 *
 * The restaurant is required: without it nobody can rebuild the order on the
 * comparison app. The items are genuinely optional - the cart screenshot stays
 * the source of truth, and nothing is read out of it automatically, so this
 * list only exists to save an admin from squinting at a cropped screenshot.
 *
 * Blank rows are dropped rather than flagged, because an empty row in an
 * optional list is one the customer chose not to fill in.
 */
export function StepBasket({
  restaurantName,
  items,
  restaurantError,
  onRestaurantNameChange,
  onItemsChange,
  onContinue,
}: StepBasketProps) {
  const restaurantId = useId();
  const itemFieldId = useId();
  // Focuses the row we just added, so adding several items stays keyboard-only.
  const pendingFocus = useRef<string | null>(null);

  const full = items.length >= MAX_CART_ITEMS;

  const addItem = () => {
    if (full) return;
    const key = crypto.randomUUID();
    pendingFocus.current = key;
    onItemsChange([...items, { key, name: "", quantity: 1 }]);
  };

  const updateItem = (key: string, patch: Partial<Omit<CartItemDraft, "key">>) => {
    onItemsChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const removeItem = (key: string) => {
    onItemsChange(items.filter((item) => item.key !== key));
  };

  const setQuantity = (item: CartItemDraft, next: number) => {
    updateItem(item.key, { quantity: Math.min(MAX_ITEM_QUANTITY, Math.max(1, next)) });
  };

  return (
    <>
      {/* Heading with the cart vignette to its right */}
      <div className="relative">
        <div className="relative z-10 max-w-[58%]">
          <h1 className="text-[1.85rem] font-extrabold leading-tight text-ink-900">
            What&apos;s in your order?
          </h1>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
            Confirm the restaurant so we can rebuild the same basket.
          </p>
          <span aria-hidden="true" className="mt-1.5 block h-[3px] w-16 rounded-full bg-brand-400" />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 -right-2 h-36 w-[42%] select-none"
        >
          <span className="absolute inset-x-0 top-2 bottom-5 rounded-[2.5rem] bg-linear-to-br from-brand-100/80 to-beige" />
          <FoodPhoto name="cartDoc" eager className="absolute bottom-2 right-4 w-[68%]" />
          <ScriptBubble className="absolute right-0 top-0 text-[0.66rem]">
            Same
            <br />
            Basket
          </ScriptBubble>
        </div>
      </div>

      <div className="mt-4 space-y-5">
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
            placeholder="e.g. Al Safadi"
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
            <h2
              id={`${itemFieldId}-legend`}
              className="text-[1.02rem] font-extrabold text-ink-900"
            >
              Your items
            </h2>
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
            Adding them helps us match your basket faster. We read the rest from your screenshot.
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

                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-ink-100 pt-2">
                    <span className="text-[0.82rem] font-semibold text-slate-500">Quantity</span>
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
                      <span
                        className="min-w-9 text-center text-[1rem] font-extrabold tabular-nums text-ink-900"
                        aria-live="polite"
                      >
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
        </section>

        {/* Reassurance strip */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-beige to-brand-100 px-4 py-3.5">
          <div className="relative z-10 flex items-center gap-3 pr-24">
            <ScriptNote underline className="shrink-0 text-[1rem] text-ink-900">
              Same Food
              <br />
              Lower Prices
            </ScriptNote>
            <p className="text-[0.8rem] leading-snug text-slate-600">
              We rebuild your exact basket first.
            </p>
          </div>
          <FoodPhoto
            name="burger"
            className="pointer-events-none absolute -bottom-1 -right-1 w-[34%] select-none"
          />
        </div>
      </div>

      <div className="mt-5">
        <Button onClick={onContinue} arrow>
          Continue
        </Button>
      </div>
    </>
  );
}
