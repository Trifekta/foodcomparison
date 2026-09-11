/**
 * Hand-maintained database types. Regenerate with the Supabase CLI once the
 * project is linked:
 *   supabase gen types typescript --linked > types/database.ts
 */

export type SubmissionStatus =
  | "new"
  | "reviewing"
  | "comparison_found"
  | "no_saving"
  /** No comparison was possible: not on the comparison app, or not rebuildable. */
  | "unavailable"
  | "result_ready"
  | "result_sent"
  | "cancelled";

export type ContactType = "whatsapp" | "email";

/**
 * Why a basket could not be priced on the comparison app.
 *
 * The customer is told the same thing whichever it is. The distinction is for
 * us: a restaurant Keeta does not carry is a coverage gap worth knowing about
 * by name, while a menu that cannot be matched is a different problem.
 */
export type UnavailableReason = "restaurant_not_listed" | "items_not_available" | "other";

export type SubmissionEventType =
  | "submission_created"
  | "review_started"
  | "comparison_added"
  | "status_changed"
  | "result_generated"
  | "result_sent";

export type AdminRole = "admin" | "reviewer" | "manager";

export interface AreaRow {
  id: string;
  name: string;
  city: string;
  emirate: string;
  active: boolean;
  sort_order: number;
  /** Internal only — never expose these to customers. */
  test_location_label: string | null;
  test_latitude: number | null;
  test_longitude: number | null;
  admin_location_notes: string | null;
  created_at: string;
}

/** The subset of an area that is safe to send to a customer's browser. */
export interface PublicArea {
  id: string;
  name: string;
}

export interface SubmissionRow {
  id: string;
  reference_number: string;
  created_at: string;
  updated_at: string;
  status: SubmissionStatus;
  source_app: string;
  source_app_other: string | null;
  area_id: string | null;
  current_total: string;
  comparison_app: string;
  comparison_total: string | null;
  saving_amount: string | null;
  saving_percentage: string | null;
  cart_image_path: string;
  checkout_image_path: string | null;
  contact_type: ContactType;
  whatsapp_number: string | null;
  email: string | null;
  marketing_consent: boolean;
  admin_notes: string | null;
  /** The restaurant as the CUSTOMER stated it on the basket step. */
  restaurant_name: string | null;
  /** The restaurant the ADMIN located on the comparison app. */
  restaurant_found: string | null;
  comparison_location_note: string | null;
  result_message: string | null;
  /** Why no comparison was possible. Only ever set alongside 'unavailable'. */
  unavailable_reason: UnavailableReason | null;
  /** Unguessable address for the customer's own result page. Never logged. */
  result_token: string;
  /** Where the rebuilt basket lives on the comparison app, pasted by an admin. */
  comparison_url: string | null;
  result_sent_at: string | null;
  review_started_at: string | null;
  completed_at: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
}

export interface SubmissionWithArea extends SubmissionRow {
  areas: { id: string; name: string; test_location_label: string | null; admin_location_notes: string | null } | null;
}

/** One line of the optional item list the customer confirmed. */
export type SubmissionItemSource = "customer" | "extracted" | "edited";

export interface SubmissionItemRow {
  id: string;
  submission_id: string;
  name: string;
  quantity: number;
  /** Price printed on that row in the screenshot, in fils. Often null. */
  line_price_minor: number | null;
  /** Whether the row was typed, read from the screenshot, or read then corrected. */
  source: SubmissionItemSource;
  sort_order: number;
  created_at: string;
}

export type ExtractionMethod = "ocr_llm" | "vision";

/** One admin-triggered basket extraction, successful or not. */
export interface SubmissionExtractionRow {
  id: string;
  submission_id: string;
  method: ExtractionMethod;
  status: "ok" | "failed";
  /** Verbatim OCR output. Null on the vision route, which runs no OCR. */
  ocr_text: string | null;
  ocr_confidence: string | null;
  ocr_engine: string | null;
  ocr_ms: number | null;
  model: string | null;
  prompt_version: string | null;
  llm_ms: number | null;
  /** The model's output. Never edited - corrections live in `confirmed`. */
  structured: Record<string, unknown> | null;
  uncertain_fields: string[];
  error: string | null;
  /** Set only when an admin explicitly confirmed the basket. */
  confirmed: Record<string, unknown> | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  created_by: string | null;
}

export interface SubmissionEventRow {
  id: string;
  submission_id: string;
  event_type: SubmissionEventType;
  previous_status: SubmissionStatus | null;
  new_status: SubmissionStatus | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export interface AdminProfileRow {
  id: string;
  display_name: string | null;
  role: AdminRole;
  created_at: string;
}
