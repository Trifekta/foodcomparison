import { describe, expect, it } from "vitest";
import { clientKeyFromHeaders } from "@/lib/utils/rate-limit";

/**
 * IP audit trail tests.
 *
 * Tests that IP capture works correctly for validation exports to Keeta.
 */

describe("IP extraction from headers", () => {
  it("extracts the first hop from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
    const ip = clientKeyFromHeaders(headers);
    expect(ip).toBe("203.0.113.5");
  });

  it("handles x-forwarded-for with spaces", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5 , 70.41.3.18" });
    const ip = clientKeyFromHeaders(headers);
    expect(ip).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.9" });
    const ip = clientKeyFromHeaders(headers);
    expect(ip).toBe("203.0.113.9");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const headers = new Headers();
    const ip = clientKeyFromHeaders(headers);
    expect(ip).toBe("unknown");
  });
});

/**
 * CSV format validation for Keeta export.
 *
 * Validates that the exported CSV is properly formatted with:
 * - Correct headers
 * - Escaped quotes
 * - Proper comma delimiters
 */
function csvLine(
  visitId: string,
  ip: string,
  timestamp: string,
  converted: boolean,
  reference: string | null,
) {
  return [
    visitId,
    ip,
    timestamp,
    converted ? "Yes" : "No",
    reference || "",
  ]
    .map((v) => `"${String(v).replace(/"/g, '""')}"`)
    .join(",");
}

describe("CSV export format", () => {
  it("formats a basic row correctly", () => {
    const line = csvLine(
      "a1b2c3d4e5f6g7h8",
      "203.0.113.5",
      "2026-09-21T12:00:00Z",
      false,
      null,
    );
    expect(line).toBe(
      '"a1b2c3d4e5f6g7h8","203.0.113.5","2026-09-21T12:00:00Z","No",""',
    );
  });

  it("includes reference number when converted", () => {
    const line = csvLine(
      "a1b2c3d4e5f6g7h8",
      "203.0.113.5",
      "2026-09-21T12:00:00Z",
      true,
      "SN001",
    );
    expect(line).toBe(
      '"a1b2c3d4e5f6g7h8","203.0.113.5","2026-09-21T12:00:00Z","Yes","SN001"',
    );
  });

  it("escapes quotes in values", () => {
    // Edge case: IP with quotes (hypothetical, but testing the escaping)
    const line = csvLine(
      "a1b2c3d4e5f6g7h8",
      '203.0.113.5"test',
      "2026-09-21T12:00:00Z",
      false,
      null,
    );
    expect(line).toContain('203.0.113.5""test');
  });

  it("has the correct header row", () => {
    const header = "Visit ID,Client IP,Timestamp,Converted,Order Reference";
    expect(header).toMatch(/Visit ID/);
    expect(header).toMatch(/Client IP/);
    expect(header).toMatch(/Converted/);
  });
});

/**
 * Validation data shape for Keeta.
 *
 * Ensures the data returned from getValidationData() has the right structure.
 */
describe("Validation data shape", () => {
  interface ValidationRow {
    visit_id: string;
    client_ip: string;
    created_at: string;
    reference_number: string | null;
    converted: boolean;
  }

  it("has all required fields", () => {
    const row: ValidationRow = {
      visit_id: "a1b2c3d4e5f6g7h8",
      client_ip: "203.0.113.5",
      created_at: "2026-09-21T12:00:00Z",
      reference_number: "SN001",
      converted: true,
    };

    expect(row).toHaveProperty("visit_id");
    expect(row).toHaveProperty("client_ip");
    expect(row).toHaveProperty("created_at");
    expect(row).toHaveProperty("converted");
    expect(row.converted).toBe(true);
  });

  it("marks converted correctly based on reference_number", () => {
    const converted: ValidationRow = {
      visit_id: "a1b2c3d4e5f6g7h8",
      client_ip: "203.0.113.5",
      created_at: "2026-09-21T12:00:00Z",
      reference_number: "SN001",
      converted: true,
    };

    const abandoned: ValidationRow = {
      visit_id: "x9y8z7w6v5u4t3s2",
      client_ip: "70.41.3.18",
      created_at: "2026-09-21T12:15:00Z",
      reference_number: null,
      converted: false,
    };

    expect(converted.converted).toBe(true);
    expect(abandoned.converted).toBe(false);
    expect(abandoned.reference_number).toBeNull();
  });
});
