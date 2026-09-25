-- Customers can view their result online without supplying a WhatsApp number.
-- Preserve the contact type and legacy email requirement.
alter table public.submissions drop constraint submissions_contact_present;
alter table public.submissions add constraint submissions_contact_present check (
  contact_type = 'whatsapp' or (contact_type = 'email' and email is not null)
);
