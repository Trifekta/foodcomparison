"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import type { PublicArea } from "@/types/database";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils/cn";

interface AreaComboboxProps {
  areas: PublicArea[];
  value: string;
  onChange: (areaId: string) => void;
  error?: string | null;
  label: string;
  hint?: string;
}

/**
 * Type-ahead for Dubai areas.
 *
 * Options come from the database, never a hard-coded list in this file.
 * Implemented as an ARIA combobox with keyboard support rather than a native
 * <select> so a customer can type "mar" and land on Dubai Marina in one tap.
 */
export function AreaCombobox({ areas, value, onChange, error, label, hint }: AreaComboboxProps) {
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
      <label htmlFor={inputId} className="mb-2 block text-[0.95rem] font-bold text-ink-900">
        {label}
      </label>

      <div className="relative">
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500"
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
          placeholder="Start typing your area"
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
            "min-h-14 w-full rounded-2xl border bg-white pl-11 pr-11 text-base font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400",
            error ? "border-rose-400" : "border-ink-200",
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
            })
          )}
        </ul>
      ) : null}

      {hint ? (
        <p id={hintId} className="mt-2 text-xs text-ink-400">
          {hint}
        </p>
      ) : null}

      <FieldError id={errorId} message={error} />
    </div>
  );
}
