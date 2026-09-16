"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import type { PublicArea } from "@/types/database";
import { type AreaGroup, filterAreas, groupAreasByCity } from "@/lib/area-groups";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils/cn";

interface AreaComboboxProps {
  areas: PublicArea[];
  value: string;
  onChange: (areaId: string) => void;
  error?: string | null;
  label: string;
  hint?: string;
  /** Visually hide the label when the surrounding card already names the field. */
  hideLabel?: boolean;
}

/**
 * Type-ahead for UAE areas.
 *
 * Options come from the database, never a hard-coded list in this file.
 * Implemented as an ARIA combobox with keyboard support rather than a native
 * <select> so a customer can type "mar" and land on Dubai Marina in one tap.
 *
 * Grouped under the city, because the list now covers every emirate and two
 * hundred ungrouped names is not something anybody scrolls. The heading is also
 * the only thing distinguishing the Al Nahda in Sharjah from the one in Dubai,
 * so it is shown even when a search has narrowed the list to one group.
 */
export function AreaCombobox({
  areas,
  value,
  onChange,
  error,
  label,
  hint,
  hideLabel = false,
}: AreaComboboxProps) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => areas.find((area) => area.id === value) ?? null, [areas, value]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => filterAreas(areas, query), [areas, query]);
  const groups = useMemo(() => groupAreasByCity(filtered), [filtered]);

  useEffect(() => {
    if (!open) return;
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", onDocumentPointerDown);
  }, [open]);

  const commit = useCallback(
    (area: PublicArea) => {
      onChange(area.id);
      setQuery("");
      setOpen(false);
      // Blurring closes the phone keyboard, which is otherwise still covering
      // half the screen after the area has been chosen.
      inputRef.current?.blur();
    },
    [onChange],
  );

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((current) => {
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        if (next < 0) return filtered.length - 1;
        if (next >= filtered.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const area = filtered[activeIndex];
      if (area) commit(area);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={inputId}
        className={hideLabel ? "sr-only" : "mb-2 block text-[0.95rem] font-bold text-ink-900"}
      >
        {label}
      </label>

      <div className="relative">
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-500"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined
          }
          aria-describedby={cn(hint ? hintId : "", error ? errorId : "").trim() || undefined}
          aria-invalid={error ? true : undefined}
          placeholder="Start typing your area or emirate"
          value={open ? query : selected?.name ?? ""}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "min-h-14 w-full rounded-2xl bg-white pl-11 pr-11 text-base font-semibold text-ink-900 shadow-sm placeholder:font-normal placeholder:text-slate-400",
            error ? "ring-2 ring-rose-400" : "ring-1 ring-black/5",
          )}
        />
        {selected && !open ? (
          <button
            type="button"
            onClick={clear}
            aria-label={`Clear ${selected.name}`}
            className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-2 max-h-64 w-full overflow-hidden overflow-y-auto overscroll-contain rounded-2xl border border-ink-200 bg-white py-1.5 shadow-lg shadow-ink-900/10"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-500">
              No area by that name. Try the emirate instead, or the nearest
              neighbourhood to you.
            </li>
          ) : (
            groups.map((group) => (
              <AreaOptionGroup
                key={group.city}
                group={group}
                listId={listId}
                selectedId={value}
                activeIndex={activeIndex}
                onHover={setActiveIndex}
                onSelect={commit}
              />
            ))
          )}
        </ul>
      ) : null}

      {/* ink-600 rather than the lighter token: this sits on the beige card,
          where ink-400 lands near 2.5:1 and reads as decoration. A line whose
          whole job is to stop somebody answering the wrong question has to be
          legible on a phone in daylight. */}
      {hint ? (
        <p id={hintId} className="mt-2 text-xs text-ink-600">
          {hint}
        </p>
      ) : null}

      <FieldError id={errorId} message={error} />
    </div>
  );
}

/**
 * One heading and the areas under it.
 *
 * Its own component rather than a nested map, because `commit` reads a ref to
 * close the phone keyboard, and a ref-reading function referenced two closures
 * deep is something the React compiler cannot prove is only ever called from an
 * event handler. Passing it across a component boundary as a plain prop settles
 * that, and the listbox reads better for it.
 */
function AreaOptionGroup({
  group,
  listId,
  selectedId,
  activeIndex,
  onHover,
  onSelect,
}: {
  group: AreaGroup;
  listId: string;
  selectedId: string;
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (area: PublicArea) => void;
}) {
  const headingId = `${listId}-group-${group.city.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <li role="presentation">
      <p
        id={headingId}
        className="sticky top-0 bg-white px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-ink-400"
      >
        {group.city}
        {group.emirate === group.city ? null : (
          <span className="font-semibold normal-case tracking-normal text-ink-300">
            {" "}
            · {group.emirate}
          </span>
        )}
      </p>
      <ul role="group" aria-labelledby={headingId}>
        {group.options.map(({ area, index }) => {
          const isSelected = area.id === selectedId;
          return (
            <li key={area.id} id={`${listId}-${area.id}`} role="option" aria-selected={isSelected}>
              <button
                type="button"
                tabIndex={-1}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => onSelect(area)}
                onMouseEnter={() => onHover(index)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 px-4 text-left text-base",
                  index === activeIndex ? "bg-ink-50" : "bg-white",
                  isSelected ? "font-bold text-ink-900" : "font-medium text-ink-700",
                )}
              >
                <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-400" />
                <span>{area.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
