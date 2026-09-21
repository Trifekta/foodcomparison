# Testing IP Audit Trail

How to test the new IP validation feature for Keeta.

## Unit Tests

Run the IP audit tests:

```bash
npm test -- ip-audit.test.ts
```

Tests cover:
- IP extraction from headers (x-forwarded-for, x-real-ip)
- CSV format and escaping
- Validation data shape and conversion flags

## Manual Testing (Local)

### 1. Run the dev server

```bash
npm run dev
```

Opens on `http://localhost:3000`

### 2. Trigger an event to record an IP

Send a POST to `/api/events` with a test visit:

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 203.0.113.5" \
  -d '{
    "event": "wizard_started",
    "visitId": "a1b2c3d4e5f6g7h8"
  }'
```

The `X-Forwarded-For` header will be captured as the client IP.

### 3. Add more events to the same visit

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 203.0.113.5" \
  -d '{
    "event": "step_basket",
    "visitId": "a1b2c3d4e5f6g7h8"
  }'
```

Because of the upsert logic, the IP is only recorded once per visit.

### 4. Check Supabase

Once you deploy/migrate:

```sql
SELECT visit_id, client_ip, submission_id, created_at 
FROM public.visitor_ips 
ORDER BY created_at DESC;
```

You should see one row per `visit_id` with the captured IP.

## Testing with Submissions (Real Orders)

### 1. Create a submission normally through the wizard

Go through the full flow (upload cart → review → submit).

### 2. Check visitor_ips table

```sql
SELECT v.visit_id, v.client_ip, s.reference_number, s.id
FROM public.visitor_ips v
LEFT JOIN public.submissions s ON v.submission_id = s.id
WHERE v.submission_id IS NOT NULL
ORDER BY v.created_at DESC;
```

Submissions should appear with their reference numbers.

## Export Testing

### 1. Trigger the export endpoint

```bash
curl "http://localhost:3000/admin/api/validation-export" \
  -H "Authorization: Bearer <your-session-token>" \
  -o validation-data.csv
```

Or with a date range:

```bash
curl "http://localhost:3000/admin/api/validation-export?from=2026-09-21&to=2026-09-21" \
  -H "Authorization: Bearer <your-session-token>" \
  -o validation-data.csv
```

### 2. Check the CSV

Should have columns:
```
Visit ID,Client IP,Timestamp,Converted,Order Reference
a1b2c3d4e5f6g7h8,203.0.113.5,2026-09-21T12:34:56Z,No,
x9y8z7w6v5u4t3s2,70.41.3.18,2026-09-21T13:45:00Z,Yes,SN001
```

## Production Testing

Before showing Keeta the data:

1. **Verify a full user journey**
   - User comes from an ad (IP captured)
   - User uploads cart, reviews, submits
   - Check `visitor_ips` has their IP + submission_id

2. **Export a date range**
   - Download CSV for today
   - Verify counts match your dashboard
   - Share sample with Keeta

3. **Check data privacy**
   - Only admins can access `/admin/api/validation-export`
   - Main funnel analytics (`funnel_events`) have no IPs
   - `visitor_ips` table is read-only for admins

## Troubleshooting

**No IPs recorded?**
- Check that X-Forwarded-For header is being sent
- Verify the events endpoint returns 204 (always succeeds silently)
- Check Supabase logs for write errors

**CSV is empty?**
- Verify events are being recorded first (`funnel_events` table)
- Check date range is correct (uses Dubai timezone)
- Ensure you're authenticated as an admin

**IPs all showing "unknown"?**
- The X-Forwarded-For header isn't reaching the server
- Check your reverse proxy or load balancer config
- In development, must manually add the header to requests
