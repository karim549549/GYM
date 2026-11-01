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
- [ ] Answers to image questions (a form can ask one, but no answer is accepted until photos have their own private storage flow) and conditional questions in the form builder.
- [ ] Profile fields the schema has no place for: where the coach works, and TikTok.

## Used by the frontend but with no backend yet

- [x] Payment-request links (`/pay/<token>`): `payment-requests` module, `payment_requests` table (migrations `0052`, `0053`), coach `POST|GET /payment-requests`, public `GET /pay/:token` and `POST /pay/:token/report`. The client's report is their word: the coach still records the payment. The client's transfer screenshot is required and stored (migration `0054`). The coach confirms a report with one tap (`POST /payment-requests/:id/confirm`, migration `0055`). Not built: telling the coach a client reported paying.
- [x] Payment receipt upload: `PUT /payments/:id/receipt`, optional for the coach.
- [ ] A transfer screenshot for platform invoices (private bucket flow).
- [ ] An endpoint for the coach to fill the intake form on behalf of a client (`submitted_by = coach`); the frontend hides the action.
- [ ] A client photo, and a way to list reminders.
- [ ] `GET /auth/me` answers `WORKSPACE_REQUIRED` for a person with several workspaces who sends no `x-workspace-id`, so the frontend cannot learn the workspaces to choose from; it needs a response that lists them.
- [ ] The public check-in view carries no coach reply, so a client opening an answered check-in cannot read it.

## Under serious consideration: remove Supabase Auth (to discuss, nothing decided)

Today Supabase issues, refreshes and revokes the tokens, stores and checks the OTP codes, and calls our Send SMS hook; we deliver the code over WhatsApp. The decision of 2026-10-25 (AGENTS.md, "Sessions and tokens") was to never run our own; the owner is now seriously considering undoing it. To settle before any work:

- [ ] Why leave: cost, lock-in, the dashboard setup (Phone provider, hook, secret), the fake we maintain in tests, or the client login the program links already needed (a scrypt credential of our own exists since 2026-10-31).
- [ ] What would have to be built or bought: a credentials table and password hashing (scrypt is already in use), signing keys and token issuing, refresh-token rotation and revocation (logout, logout-all, reset ends every session), OTP generation, expiry and attempt limits, phone verification state, the `people.auth_user_id` link, forgot-password. Compare with a library (Better Auth, Auth.js) against writing it on `jose`.
- [ ] Rate limiting stops being optional the day we own the OTP: today Supabase caps code sending, afterwards nothing does.
- [ ] The real WhatsApp client is needed either way: Supabase only stores the code and calls our hook.
- [ ] What else Supabase is: Storage is already replaced (local and S3 disks); Postgres hosting, the pooler, the `gym_backend` role and `certs/supabase-ca.crt` are separate from Auth and can stay.
- [ ] Migration path for existing users (ids in `people.auth_user_id`, sessions in the apps), the frontend's cookie session in `web/src/lib/session`, and Postman collections.
- [ ] Consents given at signup travel in Supabase `user_metadata`; they would move into our own signup call.
- [ ] If it goes ahead: new section in AGENTS.md replacing "Sessions and tokens", and the `IdentityProvider` question (deferred so far) is answered.

## Agent skills and rules (refactor later, after the market test)

The aim now is a working product to test with clients and the market. Cleaning comes after, but it is recorded so it is not forgotten.

- [ ] `.claude/skills` and `.agents/skills` are copies from the employer's `profile-service` repo (TypeORM, other modules, tickets and internal contracts). They are ignored by git on purpose and do not describe this codebase. Replace them with skills written for this repo, committed with it.
- [ ] Skills to write: the module layering as practised here (controller, service, orchestrator, query handler, policy) with Drizzle and `TransactionManager`; tenancy (workspace scope, token scopes, system scope, RLS in the same migration, isolation test); adding a route (`@RequireAction`, the route-permissions test, DTOs, stable error codes); migrations (generate, custom RLS file, no BOM, never edit an applied one); public link flows (intake, check-in, program); consent gates; tests (`HttpTestApp`, mutation check); scheduling jobs (`SchedulingService.every`, leases); seeding shared libraries before RLS.
- [ ] Audit AGENTS.md against the code and list the violations. Known so far: business checks inline in orchestrators (`BaseValidationHandler` does not exist), free functions still pending a decision (`validateEnv`, `createLoggerParams`, `configureApp`, `setupApiDocs`, `bootstrap`), the lock store reaching the database outside `TransactionManager` (an approved exception), the program-link credential code written against the "do not rebuild sessions" rule (accepted on 2026-10-31), and whatever the owner has seen beyond these.
- [ ] Bring AGENTS.md up to date with the code: the migration status line (written for 0040, the repo is past 0062), the Storage section (still describes Supabase Storage and three buckets; the code now uses local and S3 disks), the Files section, and the "Pattern skills" section.
- [ ] Decide whether the frontend (`web/.claude/skills/code-architecture`) and the backend share any rules, and where the API contract between them is written down.

## Nutrition v2: foods, recipes and meals (in progress)

Decisions (2026-10-31): foods are generic and seeded and shared; a recipe is any dish whose numbers are calculated from foods and a finished weight (what is bought or ordered as one thing stays a food); coaches add products from the label on the package, private to them, and may suggest them for everyone; a meal item is a food or a recipe; plan meals are ordered by a number, never by name, with an optional category label; nutrition data is kept in the repo (`seed-data/`) and seeded by generated migrations; names are semantic, and nothing needed backwards compatibility.

- [x] Step 1: renames (`food_portions`, `calories_kcal_per_100g`, `weekday` null = every day, ...), new tables (nutrients, food nutrients, aliases, publication requests, recipes and their parts) with row level security, Arabic search normalization in the database. Migrations 0056 to 0060.
- [x] Step 2: seed generator and the first seed (437 foods, 51 recipes) from `seed-data/`. Migrations 0061 and 0062.
- [x] Step 3 (migration 0063 adds the system-scope policies): label entry on `POST /foods` (per serving or per 100 g, converted), duplicate warning, search through aliases with ranking (shared and verified first, then the coach's own), recipes (create, copy, calculated nutrition), recipe items and substitutes in meal plans, "suggest for everyone" requests and the platform-admin review (needs a system-scope insert policy for shared foods and their children).
- [ ] Review owed: a native Egyptian cook for the Arabic names (16 changed, 14 flagged), a nutritionist for every number; 16 foods have no honest numbers yet (`seed-data/foods-pending-sourcing.json`: fesikh, mish, doum, multivitamin and 12 dishes that exist as recipes).
- [ ] Product attribution: USDA FoodData Central is CC0 (cite it); the Lebanese University report is CC BY 4.0 (attribution required, see `seed-data/README.md`); do not copy the Egyptian NNI tables, the Kaggle dataset or Open Food Facts in bulk.
- [ ] The frontend uses the old field names (`kcal100g`, `dayNo`, `foodName`, ...): update `web` to the renamed API.
- [ ] Two tests fail because of earlier API changes, not this work: `test/packages.e2e-spec.ts` ("cannot reach another coach's package", a new workspace no longer starts with packages) and `test/checkins.e2e-spec.ts` ("sends the link in WhatsApp", the schedule field is now `sendAt`).

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
