"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { SOURCE_APPS } from "@/lib/constants";
import { STATUS_ORDER, statusLabel } from "@/lib/utils/status";
import type { PublicArea } from "@/types/database";

/** Filter bar. Every filter lives in the URL so a view can be shared or bookmarked. */
export function SubmissionFilters({ areas }: { areas: PublicArea[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");

  const apply = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin?${next.toString()}`);
  };

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    apply("search", search.trim());
  };

  const hasFilters = ["status", "area", "app", "from", "to", "search"].some((key) =>
    params.get(key),
  );

  const selectClass =
    "min-h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink-200 bg-white p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-status" className="text-xs font-semibold text-ink-500">
          Status
        </label>
        <select
          id="filter-status"
          className={selectClass}
          value={params.get("status") ?? ""}
          onChange={(event) => apply("status", event.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-area" className="text-xs font-semibold text-ink-500">
          Area
        </label>
        <select
          id="filter-area"
          className={selectClass}
          value={params.get("area") ?? ""}
          onChange={(event) => apply("area", event.target.value)}
        >
          <option value="">All areas</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-app" className="text-xs font-semibold text-ink-500">
          App
        </label>
        <select
          id="filter-app"
          className={selectClass}
          value={params.get("app") ?? ""}
          onChange={(event) => apply("app", event.target.value)}
        >
          <option value="">All apps</option>
          {SOURCE_APPS.map((app) => (
            <option key={app} value={app}>
              {app}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-from" className="text-xs font-semibold text-ink-500">
          From
        </label>
        <input
          id="filter-from"
          type="date"
          className={selectClass}
          value={params.get("from") ?? ""}
          onChange={(event) => apply("from", event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-to" className="text-xs font-semibold text-ink-500">
          To
        </label>
        <input
          id="filter-to"
          type="date"
          className={selectClass}
          value={params.get("to") ?? ""}
          onChange={(event) => apply("to", event.target.value)}
        />
      </div>

      <form onSubmit={onSearchSubmit} className="flex flex-col gap-1">
        <label htmlFor="filter-search" className="text-xs font-semibold text-ink-500">
          Search
        </label>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
            />
            <input
              id="filter-search"
              type="search"
              placeholder="Reference, phone or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-10 w-56 rounded-lg border border-ink-200 bg-white pl-8 pr-3 text-sm text-ink-800"
            />
          </div>
          <button
            type="submit"
            className="min-h-10 rounded-lg border border-ink-200 px-3 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Go
          </button>
        </div>
      </form>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            router.push("/admin");
          }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-600 hover:bg-ink-100"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
