import { getValidationData } from "@/lib/admin/queries";
import { parseDateRange } from "@/lib/admin/filters";

/**
 * Validation data export for partners like Keeta.
 *
 * Downloads a CSV of real traffic: visit IDs, client IPs, timestamps, and
 * orders (if converted). Proves visits are real devices, not simulated.
 *
 * Query params: from, to (date range, optional - defaults to today)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const range = parseDateRange({ from, to });
    const data = await getValidationData(range);

    // CSV format: visit_id, client_ip, created_at, converted, reference_number
    const csv = [
      "Visit ID,Client IP,Timestamp,Converted,Order Reference",
      ...data.map(row =>
        [
          row.visit_id,
          row.client_ip,
          row.created_at,
          row.converted ? "Yes" : "No",
          row.reference_number || "",
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="validation-data.csv"',
      },
    });
  } catch (error) {
    return new Response(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 }
    );
  }
}
