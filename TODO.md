2026-10-29 — The coach-side backend is feature complete: phone authentication, workspaces, packages, clients, intake and form builder, subscriptions, payments, reminders, check-ins, exercises, workout plans, foods, meal plans, platform billing, analytics, consents, assistants and invitations. Reported validation: 943 unit tests and 981 e2e tests pass; migrations 0000–0040 are applied. This is the remaining-work checklist, not a claim of launch readiness. Suggested order: rate limiting, then erasure and export, then the real WhatsApp client.

## Launch blockers (security and legal)

- [ ] Rate limiting on register, login, OTP/resend, forgot-password, the public intake form and the public check-in form — deferred on purpose until the end, but required before real users; anyone can make us send WhatsApp messages, which costs money and uses the daily recipient cap.
- [ ] Erasure and export of a client's data on request — Egyptian data protection law 151 of 2020 gives both; account deletion is deferred by decision but remains a real requirement.
- [ ] A stable page or long-lived privacy link for a client to see and withdraw their consents after check-in links expire.
- [ ] Inbound WhatsApp STOP handling.
- [ ] A lawyer reviews the consent wording (`ConsentTextsPolicy`) and privacy policy, checks whether the Personal Data Protection Centre requires a licence for health data, and checks the basis for storing it outside Egypt (Supabase region).
- [ ] Retention and lifecycle of stored files (orphaned uploads, deleted clients, closed workspaces) and per-workspace storage caps.
- [ ] Ask for consent again when the consent text version changes.

## Real integrations (everything external is a mock or a fake in tests today)

- [ ] WhatsApp through Meta: Meta account, template approval (`subscription_expiring`, `subscription_expired`, `checkin_due`), the real client (production refuses the mock), prices and categories, and whether a coach may word a renewal message.
- [ ] Exercise Supabase end to end for real: signup, the Send SMS hook (needs a deployed URL and `SUPABASE_HOOK_SECRET`), and Storage buckets.
- [ ] Google sign-in and adding a phone to such a login; changing a phone.
- [ ] Payment gateway — not built; payments are recorded by hand; decide on Paymob, Fawry or Kashier and on coach-to-platform billing versus client-to-coach payments or both.

## Features from the product documents not built

- [ ] Photos: measurement and check-in photos (private bucket flow; clients can delete them and they disappear from the coach side), photos in forms, payment receipt upload, and platform transfer screenshot.
- [ ] Client app and client login; client workout logging (`workout_logs`, `set_logs`, strength over time); client-side analytics.
- [ ] Coach notifications (WhatsApp or in app): coach reminders (allowed by the schema), payment-due and intake-nudge reminders, and sending the intake link over WhatsApp.
- [ ] Excel export.
- [ ] Billing: invoices generated automatically as a period ends, an admin screen, and what happens to a coach who stays past due.
- [ ] Renewing a subscription ahead of its end date.
- [ ] Moving workspace ownership; inviting a second coach (shared clients between coaches is a different design); per-assistant limits; a WhatsApp message for an invitation.
- [ ] Image questions and conditional questions in the form builder.
- [ ] Profile fields the schema has no place for: where the coach works, how many clients, and TikTok.

## Needs a decision or a review from the owner

- [ ] Confirm the Pro plan price of EGP 799 — a reading of a table cell lost in the Deep Dive.
- [ ] Nutritionist review of food seed macros — 63 foods, source `estimate_v1`, currently estimates.
- [ ] Insert platform admins by hand: `insert into platform_admins (person_id) select id from people where phone = '+20...';`.
- [ ] Revisit billing carrying no credit when a coach switches plans.
- [ ] Confirm or change assistant permissions in `WorkspacePermissionPolicy` — assistants cannot read health data but can see revenue on the home screen.
- [ ] Review existing clients from before the consent feature — they have no consent rows; nothing was back-filled on purpose.

## Before and at deployment

- [x] Docker image (341 MB, non-root, multi-stage) and `render.yaml` blueprint — built and smoke-tested locally on 2026-10-29.
- [ ] Create the Render service from the blueprint as a **staging** deploy (`NODE_ENV=development`, mock WhatsApp): set the region next to the Supabase project and fill the `sync: false` variables. Production (`NODE_ENV=production`) is refused until the real WhatsApp client exists.
- [ ] Production environment variables, Supabase dashboard setup (Phone provider, phone confirmation, Send SMS hook), `WHATSAPP_PROVIDER`, and `PUBLIC_APP_URL`.
- [ ] Running migrations on deploy — today a separate step (`docker build --target migrate`, see README); decide whether CI runs it.
- [ ] CI: build, lint and unit tests on every push.
- [ ] Monitoring, alerting and database backups.
- [ ] An API and load check; a security review of the public routes.
- [ ] Postman or OpenAPI collection for the frontend team — docs are served at `/docs` outside production; OpenAPI JSON is at `/docs/openapi.json`.
