import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

/**
 * A small stand-in for Supabase's REST and Storage APIs, spoken to by the real
 * supabase-js client.
 *
 * Only what this app sends is implemented: filtered select, insert, update,
 * delete, single/maybeSingle, and object upload, download, list and remove.
 * Enough for the draft routes and the submission path to run unmodified, in
 * unit tests and behind a real browser.
 *
 * wizard_drafts gets the same check constraints 0027_wizard_drafts.sql
 * declares, so a test can prove the database would refuse a path the app
 * should never send.
 */

type Row = Record<string, unknown>;

export interface FakeSupabase {
  url: string;
  tables: Map<string, Row[]>;
  objects: Map<string, { bytes: Uint8Array; contentType: string }>;
  missingTables: Set<string>;
  reset(): void;
  close(): Promise<void>;
}

const UUID_TABLES = new Set(["wizard_drafts", "submissions", "submission_items", "submission_events"]);

function draftConstraints(row: Row): string | null {
  const id = String(row.id);
  if (typeof row.token_hash !== "string" || !/^[0-9a-f]{64}$/.test(row.token_hash)) {
    return "wizard_drafts_token_hash_shape";
  }
  for (const slot of ["cart", "checkout"] as const) {
    const path = row[`${slot}_image_path`];
    if (path === null || path === undefined) continue;
    const owned = new RegExp(`^drafts/${id}/${slot}\\.(jpg|png|webp)$`);
    if (typeof path !== "string" || !owned.test(path)) return `wizard_drafts_${slot}_path_owned`;
  }
  return null;
}

function parseValue(raw: string): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function compare(a: unknown, b: string): number {
  const left = String(a);
  return left < b ? -1 : left > b ? 1 : 0;
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [column, expression] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(column)) continue;
    const dot = expression.indexOf(".");
    const op = expression.slice(0, dot);
    const operand = expression.slice(dot + 1);
    const value = row[column];

    switch (op) {
      case "eq":
        if (String(value) !== operand) return false;
        break;
      case "neq":
        if (String(value) === operand) return false;
        break;
      case "is":
        if (value !== parseValue(operand) && !(operand === "null" && value === undefined)) return false;
        break;
      case "gt":
        if (value === null || value === undefined || compare(value, operand) <= 0) return false;
        break;
      case "gte":
        if (value === null || value === undefined || compare(value, operand) < 0) return false;
        break;
      case "lt":
        if (value === null || value === undefined || compare(value, operand) >= 0) return false;
        break;
      case "lte":
        if (value === null || value === undefined || compare(value, operand) > 0) return false;
        break;
      case "in": {
        const list = operand.replace(/^\(|\)$/g, "").split(",").map((item) => item.replace(/^"|"$/g, ""));
        if (!list.includes(String(value))) return false;
        break;
      }
      default:
        throw new Error(`fake-supabase: unsupported filter ${op}`);
    }
  }
  return true;
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function send(response: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
  if (body instanceof Uint8Array) {
    response.writeHead(status, headers);
    response.end(Buffer.from(body));
    return;
  }
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(body === undefined ? "" : JSON.stringify(body));
}

export async function startFakeSupabase(port = 0): Promise<FakeSupabase> {
  const tables = new Map<string, Row[]>();
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const missingTables = new Set<string>();
  const table = (name: string) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  };

  async function rest(request: IncomingMessage, response: ServerResponse, url: URL, name: string) {
    if (missingTables.has(name)) {
      return send(response, 404, {
        code: "PGRST205",
        message: `Could not find the table 'public.${name}' in the schema cache`,
      });
    }

    const rows = table(name);
    const accept = request.headers.accept ?? "";
    const prefer = String(request.headers.prefer ?? "");
    const wantsObject = accept.includes("vnd.pgrst.object");
    const returns = prefer.includes("return=representation");

    const reply = (result: Row[], status = 200) => {
      if (wantsObject) {
        if (result.length !== 1) {
          return send(response, 406, {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
          });
        }
        return send(response, status, result[0]);
      }
      return send(response, status, result);
    };

    if (request.method === "GET" || request.method === "HEAD") {
      let result = rows.filter((row) => matches(row, url.searchParams));
      const order = url.searchParams.get("order");
      if (order) {
        const [column, direction] = order.split(",")[0].split(".");
        result = [...result].sort((a, b) => compare(a[column], String(b[column])) * (direction === "desc" ? -1 : 1));
      }
      const limit = url.searchParams.get("limit");
      if (limit) result = result.slice(0, Number(limit));
      return reply(result);
    }

    const raw = (await readBody(request)).toString("utf8");
    const payload = raw ? JSON.parse(raw) : null;

    if (request.method === "POST") {
      const incoming: Row[] = Array.isArray(payload) ? payload : [payload];
      const created: Row[] = [];
      for (const item of incoming) {
        const row: Row = { ...item };
        if (UUID_TABLES.has(name) && !row.id) row.id = randomUUID();
        if (name === "wizard_drafts") {
          row.created_at ??= new Date().toISOString();
          row.updated_at ??= row.created_at;
          row.progress ??= {};
          row.cart_image_path ??= null;
          row.checkout_image_path ??= null;
          if (rows.some((existing) => existing.token_hash === row.token_hash)) {
            return send(response, 409, { code: "23505", message: "duplicate key value" });
          }
          const violated = draftConstraints(row);
          if (violated) return send(response, 400, { code: "23514", message: `violates check constraint "${violated}"` });
        }
        created.push(row);
      }
      rows.push(...created);
      return returns ? reply(created, 201) : send(response, 201);
    }

    if (request.method === "PATCH") {
      const target = rows.filter((row) => matches(row, url.searchParams));
      for (const row of target) {
        const next = { ...row, ...payload };
        if (name === "wizard_drafts") {
          const violated = draftConstraints(next);
          if (violated) return send(response, 400, { code: "23514", message: `violates check constraint "${violated}"` });
        }
        Object.assign(row, payload);
      }
      return returns ? reply(target) : send(response, 204);
    }

    if (request.method === "DELETE") {
      const removed = rows.filter((row) => matches(row, url.searchParams));
      tables.set(name, rows.filter((row) => !removed.includes(row)));
      return returns ? reply(removed) : send(response, 204);
    }

    return send(response, 405, { message: "method not allowed" });
  }

  async function storage(request: IncomingMessage, response: ServerResponse, url: URL) {
    const path = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\//, ""));

    if (request.method === "POST" && path.startsWith("object/list/")) {
      const body = JSON.parse((await readBody(request)).toString("utf8")) as { prefix?: string; limit?: number };
      const bucket = path.slice("object/list/".length);
      const prefix = `${bucket}/${(body.prefix ?? "").replace(/\/$/, "")}`;
      const seen = new Map<string, Row>();
      for (const key of objects.keys()) {
        if (!key.startsWith(`${prefix}/`)) continue;
        const rest = key.slice(prefix.length + 1);
        const [head, ...tail] = rest.split("/");
        seen.set(head, tail.length > 0 ? { name: head, id: null } : { name: head, id: randomUUID(), metadata: {} });
      }
      return send(response, 200, [...seen.values()].slice(0, body.limit ?? 100));
    }

    if (request.method === "DELETE" && path.startsWith("object/")) {
      const bucket = path.slice("object/".length);
      const body = JSON.parse((await readBody(request)).toString("utf8")) as { prefixes: string[] };
      const removed = body.prefixes.filter((prefix) => objects.delete(`${bucket}/${prefix}`));
      return send(response, 200, removed.map((name) => ({ name })));
    }

    const key = path.replace(/^object\/(authenticated\/)?/, "");

    if (request.method === "GET") {
      const object = objects.get(key);
      if (!object) return send(response, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      return send(response, 200, object.bytes, { "content-type": object.contentType });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const upsert = request.headers["x-upsert"] === "true" || request.method === "PUT";
      if (objects.has(key) && !upsert) return send(response, 400, { statusCode: "409", error: "Duplicate" });

      const raw = await readBody(request);
      const contentType = String(request.headers["content-type"] ?? "application/octet-stream");
      let bytes: Uint8Array = new Uint8Array(raw);
      let type = contentType;
      if (contentType.startsWith("multipart/form-data")) {
        const form = await new Request("http://local", {
          method: "POST",
          headers: { "content-type": contentType },
          body: new Uint8Array(raw),
        }).formData();
        const file = form.get("");
        if (file instanceof Blob) {
          bytes = new Uint8Array(await file.arrayBuffer());
          type = file.type || "application/octet-stream";
        }
      }
      objects.set(key, { bytes, contentType: type });
      return send(response, 200, { Key: key, Id: randomUUID() });
    }

    return send(response, 405, { message: "method not allowed" });
  }

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://fake");
    const handle = async () => {
      // Test-only controls, for browser tests running in another process.
      if (url.pathname === "/__fake/reset" && request.method === "POST") {
        tables.clear();
        objects.clear();
        missingTables.clear();
        return send(response, 204);
      }
      if (url.pathname === "/__fake/seed" && request.method === "POST") {
        const body = JSON.parse((await readBody(request)).toString("utf8")) as { table: string; rows: Row[] };
        table(body.table).push(...body.rows);
        return send(response, 204);
      }
      if (url.pathname === "/__fake/state") {
        return send(response, 200, {
          tables: Object.fromEntries(tables),
          objects: Object.fromEntries(
            [...objects].map(([key, value]) => [
              key,
              { contentType: value.contentType, base64: Buffer.from(value.bytes).toString("base64") },
            ]),
          ),
        });
      }
      if (url.pathname.startsWith("/rest/v1/")) {
        return rest(request, response, url, url.pathname.slice("/rest/v1/".length));
      }
      if (url.pathname.startsWith("/storage/v1/")) return storage(request, response, url);
      if (url.pathname.startsWith("/auth/v1/")) return send(response, 401, { message: "no session" });
      return send(response, 404, { message: "not found" });
    };
    handle().catch((error: unknown) => {
      send(response, 500, { message: error instanceof Error ? error.message : String(error) });
    });
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    tables,
    objects,
    missingTables,
    reset() {
      tables.clear();
      objects.clear();
      missingTables.clear();
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
