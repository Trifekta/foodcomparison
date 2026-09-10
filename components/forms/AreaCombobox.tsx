"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { PublicArea } from "@/types/database";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils/cn";

interface AreaComboboxProps {
  areas: PublicArea[];
  value: string;
  onChange: (areaId: string) => void;
  error?: string | null;
  label: string;
}

/**
 * Searchable single-select for Dubai areas.
 *
 * Options come from the database, never from a hard-coded list in this file.
 * Implemented as an ARIA combobox with keyboard support rather than a native
 * <select> so a customer can type "kar" and land on Al Karama in one tap.
 */
export function AreaCombobox({ areas, value, onChange, error, label }: AreaComboboxProps) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const errorId = `${inputId}-error`;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => areas.find((area) => area.id === value) ?? null, [areas, value]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return areas;
    return areas.filter((area) => area.name.toLowerCase().includes(needle));
  }, [areas, query]);

  useEffect(() => {
    if (!open) return;
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", onDocumentPointerDown);
  }, [open]);

  const commit = (area: PublicArea) => {
    onChange(area.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
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
      <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-ink-900">
        {label}
      </label>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
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
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          placeholder={selected ? selected.name : "Search your area"}
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
            "min-h-13 w-full rounded-xl border bg-white pl-10 pr-10 text-base text-ink-900 placeholder:text-ink-400",
            error ? "border-rose-400" : "border-ink-200",
          )}
        />
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        />
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto overscroll-contain rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-500">
              No matching area. We only cover Dubai right now.
            </li>
          ) : (
            filtered.map((area, index) => {
              const isSelected = area.id === value;
              return (
                <li key={area.id} id={`${listId}-${area.id}`} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => commit(area)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left text-base",
                      index === activeIndex ? "bg-brand-50" : "bg-white",
                      isSelected ? "font-semibold text-ink-900" : "text-ink-700",
                    )}
                  >
                    <span>{area.name}</span>
                    {isSelected ? <Check aria-hidden="true" className="h-4 w-4 text-brand-700" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      <FieldError id={errorId} message={error} />
    </div>
  );
}
