# gym — coach-management backend

Back-office platform for freelance coaches in Egypt: clients, subscriptions,
payments, intake forms, then plans and check-ins. This repo is the NestJS
backend. The product is described in the four `Coach CRM - *.pdf` files in the
repo root (deep dive, flows, schema, schema II). They are design documents, not
code: when they disagree with a decision recorded here, this file wins.

Claude Code reads `CLAUDE.md`, which imports this file. Codex reads this file.
Keep the rules here, nowhere else.

## Environment

- Node 24 (`.nvmrc`). Nest 12 packages are ESM-only and need it; Node 20 fails.
- Windows with PowerShell. Use `nest g ...` to scaffold modules, controllers and
  services instead of creating files by hand.
- Before saying work is done, run `npm run build`, `npm run lint` and `npm test`.
  `npm run test:e2e` boots the app against the live dev database.

## Decisions and why

| Decision | Why |
|---|---|
| NestJS 12 | Starting point of the project. |
| Drizzle ORM 0.45.4 over `pg` (not Prisma, not TypeORM) | Schema rules such as partial unique indexes and check constraints live in code; least friction with Supabase's pooler; strongest query typing. Pin the version, `latest` moves. |
| Supabase = hosted Postgres + Auth + Storage | Offload signup and token issuing. The backend verifies the Supabase JWT and owns all business logic. The frontend never talks to the database. |
| Backend connects as role `gym_backend`, not `postgres` | Supabase does not let us read or change the `postgres` password. Tables it creates are not reachable by `anon` or `authenticated`. |
| TLS verified with `certs/supabase-ca.crt` | Never set `rejectUnauthorized: false`. |

## Project structure

```
src/
  main.ts, app.module.ts, app.setup.ts   bootstrap, stays at the root
  config/                                what the values are (env.schema.ts, later typed sections)
  common/<kind>/                         cross-cutting building blocks, one folder per kind
    filters/ guards/ interceptors/ pipes/ decorators/ validators/ dto/ handlers/ clients/
  database/                              infra module: DatabaseModule, schema/, TransactionManager
  storage/                               infra module: StorageModule, the Supabase Storage client
  whatsapp/                              infra module: WhatsAppModule, WhatsAppClient and its mock
  logging/                               infra module: LoggingModule, logger options
  scheduling/                            infra module: SchedulingModule, SchedulingService
  <feature>/                             a feature module, layout below
```

1. A Nest module other modules import (database, logging, storage, whatsapp) gets its own top-level folder with its `*.module.ts`.
2. A building block that is not a module goes in `common/<kind>/`. Never flat in
   `common/`.
3. A feature module holds `*.module.ts`, `*.controller.ts`, `*.service.ts`, and
   the folders `orchestration/`, `handlers/`, `dto/`, `interfaces/`, `enums/`,
   `exceptions/`, `policies/`, `guards/`, `interceptors/`, `validators/`,
   `jobs/`, `integrations/`. A module's exceptions stay in the module, never in
   `common/`. `integrations/` holds one thin `<system>.client.ts` per external
   system (today `auth/integrations/supabase-auth.client.ts`): no database, no
   business rules, called only by its own module. Every such client extends
   `common/clients/base.client.ts` (see "Calling other systems"). Feature modules today: `auth`
   (sign-in, sign-up, the principal), `people`, `workspaces`, `members`, `packages`, `clients`,
   `intake`, `measurements`, `subscriptions`, `payments`, `reminders`, `checkins`, `exercises`, `plans`,
   `foods`, `meal-plans`, `billing`, `forms`, `analytics`, `consents`, `invitations`, `home`,
   `onboarding` and `client-overview` (`analytics`, `home`, `onboarding` and `client-overview` own no table: they only read or coordinate other modules), `health`.
4. `config/` holds values only. Code that builds a library's options from those
   values lives with the feature that uses the library (`logging/logger.options.ts`).
   Read typed values through `ConfigService`; `process.env` is read only in
   `config/` and `drizzle.config.ts`.
5. File names are `<name>.<type>.ts`, for example `transaction.manager.ts`.
6. A new file kind or folder kind needs the user's approval. Do not add
   `utils`, `helpers`, `mappers` or `constants` files.

Approved kinds beyond the list above: `*.schema.ts` in `database/schema/` (Drizzle
tables, they replace BRJ's `*.entity.ts`), `env.schema.ts` in `config/`,
`*.options.ts` (library option builders), and `database.constants.ts` (provider
tokens; kept as a file because putting them in the module causes a circular import).
`database/postgres-lock.store.ts` is the approved `*.store.ts` infrastructure adapter
implementing `@nestjs/locks`'s `LockStore`; it is not a feature handler.

Bootstrap and tooling files, each with one defined role:

- `src/app.setup.ts` is the only place that configures the Nest application
  instance. It holds `configureApp` (global prefix, versioning, validation pipe,
  exception filter) and `setupApiDocs`. `main.ts` and every test that boots an
  app call it, so tests run what production runs. It holds no business logic, no
  module wiring, and reads no config; anything that depends on the environment is
  decided in `main.ts`.
- `jest.swagger-plugin.cjs` is test tooling: a shim that lets ts-jest run the
  `@nestjs/swagger` compiler plugin, so a test can prove DTO schemas come from
  `class-validator` without swagger decorators. Nothing else belongs in it.

Pending: the final suffix naming for these file kinds is decided later.

## API shape and docs

- The API serves more than one client. Today a web app (PWA). Later a mobile app for
  clients, with real users and traffic; not built, but decisions made now must not
  rule it out. In practice: authentication is bearer tokens, never cookies or
  server-side sessions; `/api/v1` stays frozen once clients depend on it (a mobile
  app cannot be forced to update, so change it by adding, and introduce `/api/v2` for
  breaking changes); error `code`s are stable and the clients translate them; lists
  are paginated; nothing assumes a browser (no CORS-only behavior, no redirects as
  flow control). Per the product docs, a store app must contain no purchase button.
- Every route lives under `/api/v1`. `/health` is the only exception, kept
  outside the prefix and version (`VERSION_NEUTRAL`).
- Controllers and DTOs stay free of swagger decorators. The `@nestjs/swagger`
  compiler plugin (configured in `nest-cli.json`) builds schemas from the TypeScript
  types and `class-validator` rules. Add an `@Api*` decorator only when the plugin
  cannot express something, for example `@IsInt()` is documented as `number`.
- Docs are served only outside production: UI at `/docs`, OpenAPI JSON at
  `/docs/openapi.json` (import it into Postman). Authentication is declared once,
  globally, as a bearer token.
- Rate limiting is deliberately left to the end, by the user's decision. It is
  still required: the public routes (register, login, the intake form, OTP) must
  not be deployed without it. Do not raise it again before then.

## Database rules

- Schema lives in `src/database/schema/`. Change it, run `npm run db:generate`,
  read the generated SQL in `drizzle/`, then `npm run db:migrate`.
- Never use `drizzle-kit push` on the Supabase database. Never edit a migration
  that has been applied. There are no down migrations: roll forward with a new
  migration, and use expand-then-contract for anything destructive.
- Ask the user before `drop`, `truncate`, or any destructive change to the
  hosted database, and before creating or deleting Supabase projects.
- Tenancy is enforced by the database, not by remembering a filter. See
  "Auth and tenancy" below.
- Money is integer minor units (piastres). Derived states (expiring soon,
  overdue) are computed, never stored. Soft-delete clients; deactivate, never
  delete, anything old plans point at.
- Never write a migration `.sql` file with PowerShell's `Set-Content -Encoding utf8`
  or any tool that adds a byte-order mark: Postgres rejects it as a syntax error and
  `drizzle-kit migrate` fails with no message. Use `[System.IO.File]::WriteAllText`
  with `UTF8Encoding($false)`, and check the first bytes are not `EF BB BF`.
- Ids are generated by the database (column defaults) and read back with
  `RETURNING`. Code never calls `randomUUID()` for a row id. Only a test may invent
  an id for something that is not a row of ours, such as a fake Supabase user id.
- Status: migrations `0000` to `0040` are applied; `0042` (check-in time and start day, `image` questions, no `card` payment method) and `0043` (how many clients a coach has, package extras) are written and not applied yet (`0041`, the lock table, is applied or not as the deployment says). The database holds forty tables,
  `people`, `workspaces`, `workspace_members`, `packages`, `clients`, `intake_links`,
  `intake_responses`, `measurements`, `subscriptions`, `subscription_freezes`, `payments`,
  `reminders`, `checkin_schedules`, `checkins`, `muscles`, `exercises`, `exercise_muscles`, `plans`,
  `plan_days`, `plan_exercises`, `plan_sets`, `foods`, `food_units`, `meal_plans`, `meals`, `meal_items`
  `meal_item_subs`, `plans_catalog`, `platform_subscriptions`, `platform_invoices`,
  `platform_admins`, `form_templates`, `form_questions`, `person_consents`, `client_consents` and `workspace_invitations`, plus the `drizzle` schema, which is real and
  must never be dropped. Everything left over from early experiments was removed
  with the user's approval. The Supabase advisor reports `drizzle.__drizzle_migrations`
  as having no row level security; that is not an exposure, because the public API
  roles have no access to that schema.
- A test must clean up even when it fails halfway: register what it creates before
  asserting on it, or a failed run leaves rows behind.

## Layers and classes

The layering is the BRJ pattern: controller, service, orchestrator, with handlers
as tools. Everything is a class: no free functions in feature code (decorators and
framework hooks are the exception; see "Pending" below).

- **Each module owns its tables and is the only one that reads or writes them.**
  Another module gets that data by calling the owner's service, never by querying
  its table and never by importing its handler or orchestrator. Today: `people`
  owns `people`, `workspaces` owns `workspaces`, `members` owns `workspace_members` (a
  person's membership of a workspace: whether they own it, and what they do in it). A module's `exports` lists its service and
  nothing else.
- **Place code by the noun it is about, so nobody has to guess.** Before adding a
  file, ask "which noun is this?" The module named for that noun holds its table,
  its handler, its rules and its creation logic. A flow that only coordinates, such
  as `auth` registering a coach, checks what is its own (the account has a phone and
  is not registered yet) and then calls the owners' services; it does not do their
  work. So creating a workspace's owner is `members`, and the workspace handle (the slug) is
  `workspaces`.
- Controller: no logic, injects only its module's service.
- Service: the module's one interface; thin hand-off to an orchestrator.
- Orchestrator (`orchestration/<name>.orchestrator.ts`): one public `execute`,
  everything else private. It sequences handlers, asks policies, and owns the
  transaction through `TransactionManager`. It never touches the database itself.
- Query handler (`handlers/<module>-query.handler.ts`, extends
  `common/handlers/base-query.handler.ts`): all data access, reads and writes, and
  nothing else. No validation, no business errors: a missing row comes back as
  `null` or `[]`. It reads through `this.db`, which is the open transaction. Generic
  helpers (`firstOrNull`, pagination) live in the base, not in subclasses.
- Pagination is formed only in the base: `executePageQuery(source, page, limit,
  mapItems?)` returns `{ items, total, page, limit, totalPages, hasNext, hasPrev }`.
  Input is `page` and `limit`. The query DTO base is added with the first list route.
- Policy (`policies/<name>.policy.ts`): a stateless `@Injectable` class, one per
  file, returning a decision with a string `outcome`, never throwing. Only an
  orchestrator calls it, and the orchestrator turns a refusing outcome into the
  module's exception. It holds product rules only; slugs, parsing, mapping and
  matching are technical and stay private methods of the caller.
- Validation of outside input happens once, at the boundary, with
  `class-validator`'s own validators and never a hand-written regex: DTO
  decorators (`@IsUUID()`, `@IsString()`, ...) for body, query and route params;
  `isUUID()` and friends in the guard or the integration client for headers and
  token claims, which never reach a DTO. A policy, orchestrator or handler does not
  re-validate or parse. A value that is only compared against known data (a
  workspace id against the person's memberships) needs no validation at all.
- Business checks ("already registered", "phone required") belong in a validation
  handler. That base does not exist yet, so today they sit inline in the
  orchestrators: a known gap, to be closed by introducing `BaseValidationHandler`.
- A listing that is not an API list (a person's own memberships, bounded and used
  by the guard) is a plain lookup, not a paginated listing. This is a reading of the
  non-paginated-listing gate that still needs the user's confirmation.

Containment, so that replacing a dependency touches as little as possible:

- Only `*-query.handler.ts` files, `common/handlers/base-query.handler.ts` and
  `database/` import Drizzle, the schema or the `DRIZZLE` token. Controllers,
  services, orchestrators and policies never do. Changing the ORM or the database
  engine touches those files only; moving to another Postgres host is
  configuration (`DATABASE_URL`, the certificate) and no code.
- Only `auth/` knows Supabase Auth, through `auth/integrations/supabase-auth.client.ts`
  and the wiring in `auth.module.ts`. Everything else sees provider-neutral types
  such as `VerifiedIdentity`. The frontend talks only to this backend, never to
  Supabase. An `IdentityProvider` abstraction is deliberately deferred: if the
  provider changes, only the auth module changes.
- Check this with a recursive search, not a one-level glob.

Pending decisions about free functions that remain: `validateEnv`,
`createLoggerParams`, `configureApp`, `setupApiDocs`, `bootstrap`.

## Transactions

Data access goes through `TransactionManager.run(work, scope?)`. Code inside reads
`transactionManager.db`, which is the open transaction when there is one. Never
open a transaction with `db.transaction` directly, and never hand a `tx` through
method parameters. A nested `run` joins the open transaction; asking it for a
different scope throws. `attempt(work)` runs the work as a savepoint inside the open
transaction: if it fails, only its own writes and scope change are undone and the
transaction stays usable (without an open transaction it just opens one). Use it for
a step that may collide, such as taking a workspace handle.

Creating a workspace needs no scope chosen up front: the database picks the id, and
the trigger `workspaces_enter_own_scope` puts the transaction in the new workspace's
scope, but only when no scope is set, so a request acting inside one workspace cannot
create another. Two workspaces cannot be created in one transaction.

## Auth and tenancy

- Supabase Auth issues the tokens. `SupabaseAuthClient` verifies them against the
  project's public JWKS (ES256/RS256 only, issuer and audience checked). A key
  endpoint outage is a server error, never a 401.
- `AuthGuard` is global (`APP_GUARD`): every route needs a valid bearer token.
  `@Public()` opens a route (`/health`, `register`, `login`, `refresh`). A token for a
  login with no `people` row is refused with `NOT_REGISTERED`. Controllers read
  `@CurrentPrincipal()`; only `logout` reads `@CurrentAccessToken()`, to hand the
  token back to Supabase.
- The principal is `{ personId, authUserId, fullName, memberships, workspaceId?, role? }`.
  The workspace a request acts in comes from the `x-workspace-id` header, picked by
  `WorkspaceSelectionPolicy` (one membership: implicit; several: required; not a member: 403).
- Tables with a `workspace_id` have row level security **enabled and forced**.
  Policies read `app.workspace_id` and `app.person_id`, which `run(work, { workspaceId,
  personId })` sets for the transaction only. Outside a scoped transaction these
  tables return nothing: a forgotten scope fails closed, it does not leak.
- Every new tenant table gets, in the same migration: a `workspace_id` column,
  `ENABLE` and `FORCE ROW LEVEL SECURITY`, and a policy on `app_workspace_id()`.
  Every service method that touches tenant data calls `run` with the principal's
  `workspaceId`. The `personId`-only scope exists only to list a person's own
  memberships; it never widens a workspace-scoped request.
- Add assertions for each new tenant table to `test/tenant-isolation.e2e-spec.ts`.
- `people` has no row level security: only the people module reads or writes it,
  through `PeopleService`.
- Ownership and role are two separate facts on a membership (`workspace_members`).
  `is_owner` says who owns the workspace; `role` says what the member does in it:
  the `WorkspaceRole` enum (`members/enums/workspace-role.enum.ts`), `coach` or
  `assistant`. A freelance coach is an owner who coaches (`is_owner` true, role
  `coach`); a studio manager who does not train anyone is an owner whose role is
  `assistant`. Always compare with the enum, never a string literal. The column is
  `text` with a check constraint built from the enum's values (not a Postgres enum
  type, which cannot lose a value); adding a role means a migration that replaces
  `workspace_members_role_check`, and `test/workspace-role.e2e-spec.ts` fails until
  you do.
- A workspace has exactly one owner, and there is no co-owner: creating a coach creates
  their workspace and its one owner together. The database enforces at most one with a
  partial unique index (`workspace_members_one_owner_idx`). Moving ownership later is one
  transaction that clears the old owner's flag before setting the new one's. Never delete
  or demote the owner without moving ownership first (no such operation exists yet).
- What a member may do is decided in one place: `WorkspacePermissionPolicy.can(actor, action)`
  (see "Assistants and teams"), asked by `WorkspaceActionGuard` for every route that works on a
  workspace.
- Tests sign their own tokens with a throwaway key and stub the global `fetch` with an
  in-memory fake of Supabase Auth's REST calls and key set. The real Supabase project has
  not been exercised yet.

## Sessions and tokens: Supabase's, deliberately

Decision (changed on 2026-10-25, after first building our own): **Supabase issues,
refreshes and revokes the tokens.** We do not run our own signing key, refresh-token
table or rotation: that is maintenance a startup should not own, and Supabase already
does it. The frontend (web now, a client mobile app later) still talks only to this
backend, never to Supabase. The backend forwards `register`, `login`, `refresh` and
`logout` to Supabase Auth and passes its tokens through to the client as opaque
strings; `SupabaseAuthClient` verifies them on every request. Only the `auth` module
knows Supabase, so replacing it later is a change in that module.

### Who can sign in, and how (decided 2026-10-26)

A person is identified by a **verified phone number**. Two ways in, and a phone is always
verified first:

1. **Phone and password.** `POST /auth/register` (phone, password, fullName) creates the
   Supabase login and has Supabase send a code; `POST /auth/verify` (phone, code)
   confirms it, creates the person and returns the session; `POST /auth/resend` sends a
   new code; `POST /auth/login` (phone, password) signs in afterwards.
2. **Google** (not built yet, needs the Google console app): Google replaces the password,
   and the phone is still required and verified before the person exists.

There is **no phone-code-only login**: a code only proves a phone, it never signs anyone
in. A lost phone is a support dispute, handled by a person later, not an automatic flow.

- No email at signup. No workspace at signup either: registering makes a *person*;
  becoming a coach (creating a workspace and its owner) is a separate step, so the same
  sign-in serves coaches and, later, clients.
- **The person row is created only when the code is confirmed**, in `SignInOrchestrator`,
  never at `register`. Until then nothing of theirs is in our database, so an
  unconfirmed signup cannot hold anyone's phone number. The same completion runs after
  every way of getting a session: it creates the person if missing, stamps
  `people.last_login_at`, and returns `phoneRequired` (true when a login has no phone
  yet, for Google).
- `last_login_at` is set when a login succeeds (password, confirmed code), not on a
  refresh, a failed attempt or each request. A separate `last_active_at` can come later.
- **Supabase makes, stores, expires and checks every code; we only deliver it.** The
  client names no channel. Supabase calls the Send SMS hook,
  `POST /api/v1/auth/hooks/send-sms`, with the phone and the code; we send it over
  WhatsApp through `WhatsAppClient`. The hook is authenticated by
  `SupabaseHookGuard`, a Standard Webhooks signature over the exact body (so the app
  is created with `rawBody: true`, and so must any test app that calls the hook), with a
  5-minute window against replays. `SUPABASE_HOOK_SECRET` is the secret from the dashboard
  (`v1,whsec_...`); it is optional in development and required in production.
- Dashboard setup this needs (not code, done by the user): enable the Phone provider and
  phone confirmation, set up the Send SMS hook pointing at the deployed URL (a tunnel in
  development) with that secret. If phone confirmation is off, Supabase would return a
  session at signup; the client refuses that and fails loudly.
- **Forgot password** is two public calls. `POST /auth/password/forgot` (phone) sends a
  code if the number has an account and answers `202` either way, so it cannot be used to
  find out who has signed up. `POST /auth/password/reset` (phone, code, newPassword)
  confirms the code, sets the password, then ends **every** session of the person,
  including the temporary one the confirmation produced, and returns `204` with no
  token: a code proves the phone, it never signs anyone in. It is not counted as a login.
  If the password is refused (too weak) the temporary session is still ended; the code is
  spent either way, so the person asks for a new one.
- **Sign out of all devices** is `POST /auth/logout/all` (the same call as logout with
  Supabase's `global` scope). `POST /auth/logout` still ends only the current session.
- Still to build: Google sign-in and adding a phone to such a login, and changing a phone.
- Deferred by decision (2026-10-26): account deletion is not part of the MVP (it will be
  supported later; the Egyptian data-protection law and the product's photo-deletion rule
  make it a real requirement, not a dropped one), and rate limiting stays for the end.
  Rate limiting on code sending must still exist before real users: without it anyone can
  make us send WhatsApp messages, which costs money and uses up the daily recipient cap.
- Errors from Supabase become our stable codes. Nothing Supabase replied is ever put
  into an error or a log: replies can carry personal data.
- Do not rebuild a tokens or sessions module without the user asking.

## Workspaces, packages and the coach profile

A workspace is a coach's business. These are the rules; the endpoints are under
`/api/v1` and need a signed-in person (see "Auth and tenancy").

- **Becoming a coach** is `POST /workspaces` (`onboarding` module). The body may carry
  `brandName`; when it does not, the person's own name is used. One transaction creates
  the workspace with a free handle and makes the person its one owner and a coach in it. A person owns **at most one** workspace (the database's
  `workspace_members_one_owned_workspace_idx`), so a double tap cannot make two: a second
  attempt is `WORKSPACE_ALREADY_EXISTS`. The handle (slug) never changes after creation.
  `onboarding` exists because creating a workspace needs `workspaces` and `packages` and
  each needs the other's service, which would be a circular dependency; the flow that
  coordinates them is its own module and owns no table.
- **Settings** are `GET` and `PATCH /workspaces/current`: brand name, currency (an ISO
  code in capitals), units (`UnitSystem`: metric or imperial) and the days before expiry to
  alert (1 to 60). Anything not sent stays as it is; an empty body changes nothing.
- **Every endpoint that works on a coach's data** takes the workspace from
  `@CurrentWorkspaceId()`. A person with no workspace gets `NO_WORKSPACE`; a person with
  several names one in `x-workspace-id`, and one they do not belong to is
  `WORKSPACE_FORBIDDEN`. The orchestrator then runs in `transactions.run(work, { workspaceId })`.
- **Packages** (`/packages`) are what a coach sells: name, length in days, price in
  minor units (piastres). They are listed shortest first, only the active ones unless
  `?includeInactive=true`. They are **never deleted**, only set `isActive: false`, because
  subscriptions already sold point at them. `DELETE /packages/:id` removes one nobody bought
  and answers `PACKAGE_IN_USE` (409) once a subscription was sold on it. A package
  is priced in the workspace's currency, which the caller cannot choose. A new workspace
  starts with no packages: the coach adds their own. A package also keeps how often the coach checks in with someone on it (`checkInFrequency`, one of the check-in rhythms), what it `includes` (`workout`, `nutrition`) and a short `description` (300 characters at most); all three are optional and `null` clears one.
- **Payment channels** (`/payment-channels`, the `payment-channels` module and table) are where a coach's clients send money: `method` (`instapay`, `wallet`, `bank`), an `account` (an InstaPay `name@instapay` or phone number, a wallet number, a bank account) and an optional https `url` that opens the app. `GET` is for every member; `POST`, `PATCH` and `DELETE` are for the owner and coaches (`WORKSPACE_SETTINGS`). Nothing points at a channel, so a delete removes it. No money moves through the app.
- **Reminder messages** (`/reminder-messages`, the `reminder-messages` module and table) are the wording a coach chose for the three reminders: `expiring`, `expired` and `payment_due`, up to 500 characters, with `{name}`, `{days}`, `{date}` and (money only) `{amount}`. `GET` lists only the kinds the coach has written (the app shows its own default for the others); `PUT /reminder-messages/:kind { body }` writes or replaces one, for the owner and coaches (`WORKSPACE_SETTINGS`).
- **The logo** is `PUT /workspaces/current/logo` (multipart, field `file`, 2 MB at most)
  and `DELETE` on the same path. The column stores a **key**, never a URL; the public
  address is built when the workspace is read. Each upload is a new key, so a replaced logo
  is not hidden by a cached old one. The old file is deleted only after the new key is
  saved; a file that cannot be deleted is logged and left, never allowed to fail the
  request. This is where the "pending retention" item will show up as orphaned files.
- **The coach's own profile** is `GET` and `PATCH /members/me` (specialties, bio,
  Instagram, and how many clients they have now: `clientCountRange` of `lt5`, `r5_20`, `r20_50`, `gt50`), on their membership, so it is per workspace. Specialties are the `Specialty`
  enum, as the product's profile screen offers them. `null` clears a field; leaving it out
  keeps it.
- **Left out because the Schema has no place for them:** where the coach works, and TikTok (the Flows document lists them on the profile screen).
  Add the column first if they are wanted.
- Settings, the logo and packages are for the owner and coaches; an assistant can read them. See
  "Assistants and teams".

## Clients

A client is a coach's relationship with one person (`/clients`, owned by the `clients`
module; every call acts in the coach's workspace).

- `POST /clients` takes a name and a phone and adds the client with `intakeStatus:
  pending`. The phone is kept in international form. The client can be someone who has
  never signed up; when the number belongs to a person who has, the client is linked to
  them (`personId`), and the link follows the number if it is edited. Which person owns a
  number is the people module's to say (`PeopleService.findByPhone`).
- A workspace has one client per phone number (`CLIENT_ALREADY_EXISTS`); two coaches can
  each have the same person. The database's unique rule is the last word when two requests
  race, and the orchestrators turn it into that same code.
- **Clients are soft-deleted** (`deleted_at`), so removing one by mistake loses no payment
  history. `DELETE` hides them and answers `404` the second time. Adding the same number
  again **brings the removed client back** (same id, new name) rather than making a
  second one; how far along their intake was is kept.
- `GET /clients` is served by `client-overview` (a module with no table: the subscription, plan and check-ins belong to modules that already depend on `clients`). Each client carries a `summary` worked out on every read: the running subscription (`id`, `packageName`, `state`, `endsOn`, `daysLeft`) or `null`, `hasPlan`, `nextCheckinInDays` and `missedCheckins` (last thirty days). It asks each owner once for the whole page. It is the first paginated list: `?page&limit` (limit 1 to 100, default 20)
  through `PaginationQueryDto` and `executePageQuery`, newest first, with `?status` and
  `?search` (part of a name or of a number; the characters of a pattern are plain text).
  Every list endpoint takes its paging from `PaginationQueryDto` and returns the one
  `{ items, total, page, limit, totalPages, hasNext, hasPrev }` shape.
- The status and the link to a person are never sent by the client of the API: a coach
  cannot declare a client's intake done, only the intake itself does.

## Files

All file operations go through a file handler that extends
`common/handlers/base-file.handler.ts` (`<module>-file.handler.ts`, for example a
workspace's logo in `workspaces/handlers/`). Nothing else touches storage.

- Today the store is **Supabase Storage**, reached only through
  `storage/integrations/supabase-storage.client.ts` (a `BaseClient`). It signs in with
  `SUPABASE_SECRET_KEY`, which bypasses Supabase's own access rules, so the key never
  leaves the backend and every rule about who may see a file is ours. Moving to AWS S3
  later means replacing that client and the base handler's calls into it; module file
  handlers do not change. Only `storage/` knows Supabase Storage.
- Buckets (`storage/enums/storage-bucket.enum.ts`), created once with SQL on the hosted
  project because `storage` is Supabase's schema, not ours:
  `gym-public` (public: logos, later exercise media, 10 MB), `gym-files` (private:
  payment receipts and other private images, 10 MB) and `gym-photos` (private:
  measurement photos only, 6 MB). All three accept only `image/webp`, because
  `putImage` always stores WebP; a bucket refuses anything else even if our code
  slipped. Widening that list is a deliberate change that needs a written rule first.
  A file handler declares its `bucket`; measurement photos never share a bucket with
  anything else. Never make a private bucket public.
- The object store has no row level security, so tenancy is in the key: a workspace's
  files live under `workspaces/<workspaceId>/...` and `workspaceKey` is the only way to
  build one. A handler never accepts a key from outside.
- Files are shown through signed links that expire (default 5 minutes, never more than
  an hour), not stored URLs. Store the key, never a URL.
- Upload validation, where each check lives (decided; built with the first upload
  endpoint, not before):
  1. Size is capped twice. The hard cap is multer's `limits` on the upload interceptor
     (`fileSize`, `files`), which aborts the request while it is being read; a pipe only
     runs after the body is buffered, so it cannot be the first line. The pipe repeats
     the size check to return our error code.
  2. Type is checked in `common/pipes/image-upload.pipe.ts` (`ImageUploadPipe`, built;
     use it as `@UploadedFile(new ImageUploadPipe({ maxBytes }))`), by the file's magic
     bytes through `file-type`, never by extension or the declared content type. It
     accepts JPEG, PNG and WebP. HEIC (the iPhone format) is refused on purpose and is the
     clients' job: they convert and compress to JPEG before upload, as the product
     documents already ask. The server will not decode it: `sharp` ships without HEIC
     support (patents) and each extra decoder is more attack surface. Checks
     the real length, and returns the type the bytes say. It is our own pipe, not Nest's
     `ParseFilePipe`, because that reports every failure as one string and the clients
     need separate codes (`FILE_REQUIRED`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`; one code for every "too big", whether the upload parser or the pipe caught it).
     A per-purpose pipe (logo, photo, receipt) is a subclass that sets its limits, added
     with its first endpoint.
  3. Every image is decoded and re-encoded by `BaseFileHandler.putImage` (built) before
     it is stored, always as WebP, upright, no larger than `maxEdgePx`, never enlarged.
     That removes anything hidden in the file and the metadata a photo carries (GPS),
     and a 50-megapixel input limit stops decompression bombs. Anything that does not
     decode throws `INVALID_IMAGE`. It returns the stored key (the one given plus
     `.webp`). This is processing, not validation, so it is the file handler's job. The
     only way to store bytes untouched is `putUnprocessedFile`, which is not for images.
     The key is built by us, never from the client's name.
  4. A file that is not an image (PDF, video) is not accepted until a feature needs it,
     and then it needs its own written rule first (download-only serving, scanning).
- Pending, not now: retention and lifecycle of stored files (orphaned uploads, deleted
  clients, closed workspaces, abandoned intake uploads) and per-workspace storage caps.

## WhatsApp

WhatsApp is the product's channel for verification codes, alerts and reminders (Deep Dive,
Flows 1 and 5). Everything sends through `WhatsAppClient` (`whatsapp/whatsapp.client.ts`,
module `WhatsAppModule`); nothing else knows who delivers.

- Only approved templates can be sent: a message names a `WhatsAppTemplate` and its
  parameters, never free text, because WhatsApp only lets a business open a conversation
  with a template. Adding a message means adding the template (and its parameter count)
  there first, and having Meta approve it.
- `WHATSAPP_PROVIDER` picks the client. `mock` (the default) records messages in
  `outbox` and prints them to the console, code included, so a flow can be tried by hand;
  it is the one place a code or number is logged on purpose. The environment check
  refuses `mock` in production, and `meta` refuses to start until that client exists, so
  a deployment can never run while silently sending nothing.
- The base class validates the recipient (international format) and the parameters, so
  the mock refuses what the real client would. Errors never repeat the parameters.
- Tests use the mock's `outbox` and `lastTo(number)` to read the code a flow sent.
- Not decided yet (do not build around a guess): the Meta account and whether it can run
  unverified (new portfolios start at 250 recipients per 24 hours), the message prices
  and categories, whether a coach's own wording of a renewal message is allowed. Email verification was considered as a
  fallback; it needs a verify/resend call (the auth client has none yet), your own SMTP
  service (Supabase's default sends only to team members, 2 per hour) and a domain.

## Calling other systems

Every HTTP call to another system goes through a client that extends
`common/clients/base.client.ts` (approved folder kind `common/clients/`). Never call
`fetch` or an HTTP library from anywhere else.

- The base builds the request, times out each attempt (10s default), retries and turns
  "could not reach it" into the subclass's own error via the abstract `unavailable()`.
  A subclass has no try/catch around the call.
- A body of bytes (`Uint8Array`) is sent as it is; anything else is sent as JSON.
- It does not judge HTTP statuses: 4xx and 5xx come back as `{ status, body }` and the
  subclass maps them to the module's exceptions, because only it knows what they mean.
- Retries are for what is safe to repeat. Reads, PUT and DELETE are retried on a
  network failure or a 502, 503, 504; 429 and 500 never are. POST and PATCH are not
  retried unless the call passes `retry: true`, and it may do that only when repeating
  changes nothing (sign-in, logout). Creating something, or spending a one-time token
  such as a rotated refresh token, never opts in. Every new client method decides this
  on purpose and has a test for it.
- Retrying is bounded so a request never hangs and a struggling system is not hammered:
  `attempts` is 1 to 5 (the constructor throws otherwise), each attempt times out at 5s,
  and the whole call, waits included, ends within `totalTimeoutMs` (10s). The last
  attempt's timeout is cut to the time left, and no retry starts if its wait would pass
  the deadline. Do not raise these per client without a reason that is written down.
- Nothing from the other system's reply goes into an error or a log. The base drops the
  cause of a transport failure because it can carry hosts and addresses.
- A circuit breaker, when added, goes into the base's attempt loop and nowhere else.

## Errors and logging

- `try/catch` has three legitimate uses: translating a library or provider error into
  ours, recovering from one specific error and carrying on, or retrying. Never catch to
  log, to wrap generically or to rethrow; the global filter already does that, so an
  error nobody handles should simply propagate. Transport failures belong to the base
  client, not to its callers.

- Throw Nest `HttpException` subclasses with a stable `code`, for example
  `new ConflictException({ code: 'CLIENT_LIMIT_REACHED', message: '...' })`.
  The frontend translates by `code`, never by message. Do not catch database
  errors to rewrap them: the global filter already maps unique, reference and
  constraint violations, and hides everything unknown behind a generic 500.
- Every error body is `{ statusCode, code, message, details?, path, requestId? }`.
- Log with Nest's `Logger` (routed to pino) or `PinoLogger`. Never `console.log`.
  Every line in a request carries the request id; `x-request-id` is echoed back.
- Never log tokens, passwords, phone numbers, request bodies, or query strings.
  The logger redacts `password`, `token`, `access_token`, `refresh_token` and
  `phone` by field name, so use those names and add to the list in
  `src/logging/logger.options.ts` when a new sensitive field appears. A credential
  inside a URL path (an intake link token) is not covered: redact that route
  explicitly when it is built.
- Never print a Drizzle query error object: its message holds the SQL and parameters.

## Secrets

`.env` holds the database password. Do not read, print or commit it. Only
`.env.example` is tracked. `certs/supabase-ca.crt` is public and is tracked.

## Intake and measurements

A client hands in their details through a link, with no account (`intake` module).

- The coach asks `POST /clients/:id/intake-link`; the link is `${PUBLIC_APP_URL}/f/<token>`, a
  CSPRNG 8-character alphanumeric token, valid 14 days. Asking again while one is open returns
  it; once used or expired it makes a new one (that is how a form is reopened). The coach
  shares it by hand: nothing is sent automatically yet.
- `GET|POST /intake/:token` are `@Public()`; the token is the only credential. They run under
  the `intakeToken` transaction scope, which a SELECT-only policy (`intake_links_by_token`)
  answers; everything after that runs in the link's workspace. The public view carries the
  coach's brand, the client's name and the form, never ids or phone numbers.
- Submitting validates the answers first, then in one transaction claims the link
  (`UPDATE ... WHERE submitted_at IS NULL AND expires_at > now()`, so two at once yield one),
  stores the response, sets the client's `intake_status` and records weight, height, target
  weight, sleep and stress as `measurements`. Any failure leaves the link open.
- Questions are data (`IntakeFormPolicy`, version `default_v1`, units follow the workspace);
  answers are stored as submitted with their form version.
- `measurements` and the intake tables reference `clients` with composite foreign keys
  `(client_id, workspace_id)`, so a row cannot point at another tenant's client.
- Domain exceptions may carry `details` (a string list); the filter passes it through.
- Launch blocker: the public intake routes need rate limiting before real users.
- Not built: photos in the form, sending the link over WhatsApp, notifying the coach.

## Subscriptions, payments and the home screen

`subscriptions` owns `subscriptions` and `subscription_freezes`; `payments` owns `payments`; `home`
owns nothing and only adds the two together.

- **Selling** is `POST /clients/:id/subscriptions` (package, optional `startsOn`, optional agreed
  `priceMinor`). The package's name, price and currency are **copied** onto the subscription, so
  changing a package later never rewrites what was charged. The end date is the last day covered:
  30 days from the 1st end on the 30th. A client has **one live subscription** (active or frozen),
  enforced by a partial unique index. A live one whose term is over is closed (`ended`) to make room;
  one still running is not touched, because that would throw away paid days: `CLIENT_HAS_ACTIVE_SUBSCRIPTION`.
- Only the **status** is stored (`active`, `frozen`, `ended`, `cancelled`). What the coach sees,
  `state` (`active`, `expiring_soon`, `expired`, `frozen`, `payment_overdue`, `ended`, `cancelled`),
  `paidMinor`, `dueMinor` and `paymentStatus` are worked out on every read (`SubscriptionStatePolicy`).
  Money owed within the term shows as `payment_overdue` before `expiring_soon`.
- **Dates are calendar days in Egypt** (`SubscriptionDatesPolicy`, `Africa/Cairo`), as `YYYY-MM-DD`.
  Date fields in DTOs use `@CalendarDate()`.
- **Freeze** (`POST /subscriptions/:id/freeze`) and **resume** keep every pause in
  `subscription_freezes`; resuming adds the frozen days back to the end date. **Cancel** keeps the
  subscription and its payments. `PATCH /subscriptions/:id` moves the end date by hand.
- **Payments** are one row per amount received (`POST /subscriptions/:id/payments`): a part payment is
  two rows. The subscription row is locked (`FOR UPDATE`) while the amount is checked against what is
  owed, so two payments that together exceed the price cannot both get in (`PAYMENT_EXCEEDS_DUE`).
  An expired subscription can still be paid; a cancelled one cannot. `GET /payments` (paginated,
  filters: client, subscription, method, `from`, `to` inclusive) and `GET /payments/summary?from&to`.
  Payment foreign keys are `NO ACTION`, not `RESTRICT`, so deleting a whole workspace still works.
- `GET /home` is the three numbers of the home screen (active clients, this month's revenue,
  renewals due within 7 days) and nothing more, as the product asks.
- Not built: payment receipt upload (the column `receipt_key` exists; the response has `receiptUrl:
  null`), Excel export, renewing ahead of the end date (a running subscription must be cancelled
  or wait), the coach's own alerts as stored rows (the coach reads them from the list endpoints).

## Reminders

### Background scheduling

- Feature jobs stay in their module's `jobs/` folder, call only their module's service,
  and register through `SchedulingService.every`. Nest's `SchedulerRegistry` owns the timers;
  the shared service handles registration, shutdown and sanitized failure logging. Do not add
  private timer loops or local `running` flags to feature jobs, or a base job/cron handler.
- `SchedulingModule` configures `@nestjs/schedule` and `@nestjs/locks` once. Each job uses
  an explicit stable key with `@OnOneInstance` and `@WithoutOverlapping`. Renaming a class
  must not change the key. The current keys are `reminders:dispatch` and `checkins:top-up`.
- `DatabaseModule` registers `PostgresLockStore`. Its global `locks` table and fencing
  sequence are infrastructure, not tenant records, and grant no access to API roles.
  Lease SQL statements autocommit through the injected database independently of
  `TransactionManager`: this is an explicit infrastructure exception so lock renewals
  cannot join or wait for business transactions. Never hold a transaction for a whole job.
- A lease lasts 30 seconds, renews while held, and store calls time out after 5 seconds.
  Jobs pass `LocksContext.signal` through the service; orchestration checks it between
  units of work and before delivery/creation. An already-running external request is not
  forcibly cancelled. Existing row claims and uniqueness constraints remain necessary;
  a lease alone is not exactly-once delivery or write fencing.
- `REMINDER_POLL_SECONDS` (default 60) and `CHECKIN_TOPUP_SECONDS` (default 3600) keep their
  existing meaning; zero disables registration completely. Only check-in top-up runs at
  startup. Both jobs currently have one active runner across instances, so reminder
  dispatch has one batch of 50 per poll. Locks wait for active runs during graceful shutdown;
  the database pool closes later in `onApplicationShutdown`.
- Store concurrency, expiry and stale ownership are covered by the package contract suite
  in `test/postgres-lock-store.e2e-spec.ts` against real PostgreSQL. Scheduling coordination
  uses a shared in-memory store in unit tests; it must never be the deployed store.

`reminders` owns the `reminders` table. Messages are **created ahead of time**, not discovered each
morning, which leaves a record of what went out and makes a retry or a second worker harmless:
`unique (subject_type, subject_id, kind, audience)` stops a client being told twice.

- A subscription's end date plans two WhatsApp messages to the **client**: three days before and on
  the end date, at 10:00 in Egypt (`ReminderSchedulePolicy`, which follows Egypt's summer time).
  Setting or moving the end date drops what has not gone out and plans again; what already went
  out stays and is never sent twice; freezing or cancelling drops the unsent ones. A check-in link
  is planned the same way (`checkin_due`).
- The sender (`ReminderDispatchOrchestrator`, run by `ReminderDispatchJob` every
  `REMINDER_POLL_SECONDS`, 0 = off) claims due rows with one `UPDATE ... FOR UPDATE SKIP LOCKED`
  that marks them sent, then delivers each inside its own workspace. **Marked before sending**, so a
  crash loses a reminder rather than sending it twice; a failure is recorded as `failed_reason`
  (`client_removed`, `send_failed`, never the provider's error) and not retried.
- **The system scope.** The sender works through every workspace, so `TransactionManager` has a
  scope `{ system: true }` (`app.system = 'on'`). Only `reminders` (all operations) and
  `checkin_schedules` (**read only**) have a policy for it, through `app_is_system()`. It reaches
  nothing else; the client, workspace and the rest are still read one workspace at a time.
  `test/tenant-isolation.e2e-spec.ts` proves it.
- Templates in `WhatsAppTemplate`: `subscription_expiring`, `subscription_expired`, `checkin_due`,
  each with 3 parameters; they need Meta's approval before the real client exists.
- Not built: the coach's own reminders (the schema allows `audience: coach`), payment-due and
  intake-nudge reminders, the coach editing the renewal wording once. A client's WhatsApp consent is enforced
  (see "Consent"): without it the reminder is recorded as `no_consent`.

## Check-ins

`checkins` owns `checkin_schedules` (one per client) and `checkins`. Like reminders, a check-in is a
row created ahead of its day, so a **missed** one is a row (due in the past, never handed in): that
is what "gone quiet" and the adherence rate are counted from.

- Coach: `PUT|GET|DELETE /clients/:id/checkin-schedule` (frequency `daily`, `every_2_days`, `weekly`,
  `fortnightly`; `dayOfWeek` 0 = Sunday, default Friday; `sendAt` as `HH:MM` in Egypt, default 08:00; `startsOn`, default today: no check-in is made before it). Setting it makes the
  next 28 days of check-ins; changing the rhythm drops the coming unanswered ones (today's stays,
  its link may be on the client's phone) and makes them again. `CheckinTopUpJob` (every
  `CHECKIN_TOPUP_SECONDS`, 0 = off) keeps the month ahead made, continuing from the last due day so a
  fortnightly rhythm never shifts. `GET /checkins` (handed-in first, newest first; filters client,
  `status`, `needsReply`), `GET /checkins/:id`, `POST /checkins/:id/reply`, `GET /checkins/at-risk`
  (two or more missed in 30 days).
- Client: `GET|POST /checkin/:token`, `@Public()`, under the `checkinToken` scope and the SELECT-only
  policy `checkins_by_token`, exactly as the intake link. Opens on its day, closes 14 days later
  (`CHECKIN_NOT_OPEN`, `CHECKIN_EXPIRED`), single use (`UPDATE ... WHERE submitted_at IS NULL`).
  The default form (`checkin_v1`) needs only weight and two adherence counts (under two minutes);
  it has the intake form's shape, so `IntakeFormPolicy.check` judges both. The numbers become
  `measurements` with source `checkin`.
- `PUT /clients/:id/checkin-schedule` takes `sendAt` (`HH:MM` in Egypt) and `startsOn` (nothing is asked before it); `dayOfWeek` is always kept (default Friday) and only a weekly or fortnightly rhythm uses it. `GET /checkin-schedules` lists every client's schedule, and `GET /checkins` takes `dueFrom` and `dueTo`. The old `send_hour` column is legacy and dropped in a later migration.
- Not built: photos (they need their own private bucket flow and the client's right to delete them),
  voice-note replies. The coach-built question set is the form builder (see "Forms").
- Launch blocker, as for the intake: the public check-in routes need rate limiting.

## Shared libraries: exercises and foods

`exercises` (with `muscles`) and `foods` (with `food_units`) each hold **the library's own rows and a
coach's additions in one table**: no `workspace_id` means everyone sees it, a workspace id means it
is that coach's. Row level security is the one rule: anyone reads `workspace_id IS NULL OR own`; only
`workspace_id = own` can be inserted, changed or deleted, so a library row is read-only through the
application (`EXERCISE_NOT_EDITABLE`, `FOOD_NOT_EDITABLE`, 403) and a coach cannot write into another's.
The library rows are seeded in the migration **before** row level security is turned on in it
(`0027`, `0031`), because afterwards nothing without a workspace can be inserted; a new library row is
a new migration with the same order. Nothing is ever deleted: `PATCH { isActive: false }` hides it
from the list while plans that hold it keep rendering.

- **Exercises**: `GET /muscles` (20, the anatomy drawing's paths: `svgPathId`), `GET|POST /exercises`,
  `GET|PATCH /exercises/:id`. List filters: `q` (Arabic or English name), `equipment` (comma separated,
  any of), `muscle` (primary or secondary), `difficulty`, `pattern`, `includeInactive`. Muscles and
  equipment are enums (`MuscleId`, `Equipment`); a test makes the table and the enum agree. A video is a
  YouTube link only (embedded in the page). The seed is 41 exercises, Arabic names and cues.
- **Foods**: `GET|POST /foods`, `GET|PATCH /foods/:id`. **Macros are per 100 g, always**; the units
  (`food_units`: a cup, a loaf, a piece, each so many grams) are what make it usable. A food's numbers
  must not contradict themselves (`FoodMacrosPolicy`: calories within a quarter, at least 20, of
  4 p + 4 c + 9 f; at most 100 g of macros; fibre no more than carbohydrates): `INVALID_FOOD` with
  `details`. One default unit per food, the first listed when none is marked. Composite Egyptian
  dishes (koshari, mahshi, fatta...) are **one food each**, not recipes.
- **The seed numbers are estimates** (`source: 'estimate_v1'`, rounded from published composition
  tables, 63 foods) and have **not been reviewed by a nutritionist**: a launch task. A test checks every
  library food against the same macro rule.

## Workout plans

`plans` owns `plans`, `plan_days`, `plan_exercises` and `plan_sets`. A plan is weeks of days of
exercises of sets, for a client **or a template in the same table** (`is_template`, no client), so
"save as template" is a copy.

- `POST /plans` (`clientId` for a client's plan, none for a template; `fromPlanId` copies another plan,
  the default way to start), `GET /plans` (paginated; `clientId`, `template`, `status`),
  `GET|PATCH /plans/:id`, `PUT /plans/:id/days` (**the whole structure at once**: whatever is not listed
  is removed), `POST /plans/:id/activate|end|save-as-template`, `DELETE` (drafts and templates only;
  a plan that ran is the client's record).
- A new workspace starts with **three one-week templates** (full body 3 days, push/pull/legs, upper/lower),
  built from library exercises by slug in the onboarding transaction (`StarterPlansPolicy`).
- Saving days: `PlanStructurePolicy` (no day twice, none past the plan's last week, no exercises on a
  rest day, no superset of one) then every exercise must be visible to the coach and active, unless the
  plan already holds it. The exercise's **name is copied** onto the plan. `reps` is text (8-10, AMRAP).
  The JSON body limit is 1 MB (`app.setup.ts`) because a long plan is far over the default 100 KB; rows
  are inserted in chunks for the same reason.
- A client has **one active plan** (partial unique index); activating ends the previous one. Two starts at
  once leave one running (`PLAN_ACTIVATION_CONFLICT` for a loser that hit the index).
- Not built: **client workout logging** (`workout_logs`, `set_logs`, "my bench press over six months"): it
  needs the client to sign in, and the client app and login are not built.

## Nutrition plans

`meal-plans` owns `meal_plans`, `meals`, `meal_items` and `meal_item_subs`; the same shape as workout
plans (client or template, `fromPlanId`, activate/end/save-as-template, `PUT /meal-plans/:id/meals`
saves the whole plan), with these rules:

- **Resolved at save time.** An item stores what the coach chose (quantity and unit) **and** what it
  resolved to (grams and kcal, protein, carb, fat, copied from the food, `MealMacrosPolicy`): totals are
  sums with no join, and correcting a food next month does not rewrite a plan a client follows. A unit
  must be one of that food's; no unit means the quantity is in grams.
- `meal.dayNo` 0 repeats every day, 1 to 7 pins a weekday. **Totals** (`MealPlanTotalsPolicy`) are one
  daily total while every meal repeats, **seven** once any is pinned (the everyday meals plus that day's),
  each with the **gap to the targets** (target minus total, positive = short, null with no target) and
  the macro split in percent (adds to 100). They are worked out on every read.
- Substitutes (up to 5 per item) are complete alternatives with their own numbers; one cannot be the
  item itself or repeated. At most 10 meals a day. `timeHint` is `HH:MM`.
- A new workspace starts with two templates (cutting, bulking) in Egyptian foods, amounts in each
  food's default unit.

## Forms: the coach's own questions

`forms` owns `form_templates` and `form_questions`. A coach can replace the intake form and the check-in form
(`FormPurpose`: `intake`, `checkin`) with their own questions. Until they do, the built-in forms
(`intake default_v1`, `checkin_v1`, in `IntakeFormPolicy` and `CheckinFormPolicy`) are used, with Arabic labels
from `DefaultFormLabelsPolicy`.

- `GET /forms/:purpose` is what is in use (built-in or custom), `PUT /forms/:purpose` saves the **whole** form
  as a **new version** (`custom_v1`, `custom_v2`, ...: old versions are never edited, so a stored answer is always
  read against the questions it was given), `DELETE` goes back to the built-in form, `GET /forms/templates/:id`
  reads the version an answer was given on. Two saves at once leave one winner (`FORM_VERSION_CONFLICT`).
- `FormDefinitionPolicy` judges a form: 1 to 60 questions, a select needs 2 to 30 distinct options, a scale is
  a whole number 1 to 10, ranges must make sense, `INVALID_FORM` (422) lists every problem with where.
- **`mapsToMetric`** is what keeps the charts alive once questions are the coach's: a number question tagged
  `weight`, `height`, `target_weight`, `waist`, `chest`, `arm`, `sleep_quality`, `stress_level` or `energy_level`
  is copied into `measurements` when answered; an untagged one lives only in the answers. Each metric once per
  form, and a measured number needs a unit.
- Answers are keyed by question id and stored with the form version and, for a custom form, `template_id`
  (on `intake_responses` and `checkins`). A link opened before a new version was saved is answered against the
  current one. The public intake and check-in flows read the form through `FormsService.currentFor`.
- `image` can be asked as a question type, but no answer to it is accepted yet (it is refused as invalid): photos need the private photo bucket flow first. Not built: conditional questions.

## Consent

`consents` owns `person_consents` and `client_consents`. Egypt's data protection law (151 of 2020) wants consent
that is explicit, specific, recorded and as easy to withdraw as to give, and health data is sensitive. A client's
health data is the product, so consent is enforced where data is read and messages are sent, not only recorded.

- **A ledger, never a flag.** A choice is a new row (`granted`, the `text_version` shown, the `source`, the time); rows
  are never edited or removed (`client_consents` has no UPDATE or DELETE policy, rows go only with their client or
  workspace). The current answer is the newest row per type (`seq` orders them, the clock can tie). `ConsentStatus`
  is `granted`, `withdrawn` or `none`: never asked is not the same as refused. A row is added only when it changes
  where a consent stands.
- **Account holders** (`PersonConsentType`): `terms` and `privacy_policy` (required, one `acceptTerms: true` at
  `POST /auth/register`, which is refused without it) and `platform_notifications` (optional, `platformNotifications`).
  They travel in Supabase `user_metadata` and are written when the person comes to exist, at the code confirmation
  (source `signup`). `GET|PUT /consents/me`: only the notifications can be changed; the terms are what the account
  stands on. Verification codes are the service itself and need no consent. Nothing sends platform messages yet.
- **Clients** (`ClientConsentType`): `data_processing` and `health_data` (both required) and `whatsapp_notifications`
  (optional: refusing it never blocks coaching). The client gives them on the intake form (`consents` in the body of
  `POST /intake/:token`; without both required ones the whole submission is `CONSENT_REQUIRED` 422 and the link stays
  open). The form shows the wording from `GET /intake/:token` and `GET /consents/texts`.
- **Only the client can agree.** A coach can note that a client withdrew (`POST /clients/:id/consents/withdraw`, source
  `coach_on_behalf`), never give consent for them (`ConsentSourcePolicy`). `GET /clients/:id/consents` shows where each
  stands. The client changes their own choices from the check-in link they hold: `GET|PUT /checkin/:token/consents`,
  which works however old the link is, so taking a consent back never depends on a check-in being open.
- **What it gates** (all derived from the ledger on every call, nothing stored, so no cross-module cancelling):
  the coach reading the intake answers or `/clients/:id/progress` (`CLIENT_CONSENT_REQUIRED` 403 naming what is
  missing); a check-in being handed in (same error); a check-in's answers on `/checkins` (set to `null` with
  `answersHidden: true`, the check-in itself stays); every WhatsApp reminder (not sent, recorded as
  `failed_reason = 'no_consent'`, so a client the coach added by hand hears nothing until they have been through the
  intake). Withdrawing health data or data processing closes the reading; agreeing again opens it.
- **Wording** lives in code (`ConsentTextsPolicy`, Arabic and English, one `VERSION`). Changing a sentence means a new
  version. The texts are a draft: **a lawyer must read them before launch.**
- Existing clients from before this feature have no rows and therefore no consent: nothing was back-filled, because a
  made-up consent is worse than none.
- Not built, and needed before real users: a **stable page for the client** to see and withdraw their consents once the
  check-in links have expired (needs the client app or a long-lived privacy link), an inbound WhatsApp "STOP" handler,
  **erasure and export on request** (the law gives both; account deletion is deferred by decision, see "Sessions and
  tokens"), consent for the client's photos when those exist, and a re-ask when the text version changes. Egypt's
  law may also require a licence from the Personal Data Protection Centre for sensitive data and a basis for storing it
  outside Egypt (Supabase's region): a legal task, not code.

## Assistants and teams

A person has **one place in a workspace**, in one role (`unique (workspace_id, person_id)`), but any number of
workspaces: they can be an assistant in one and the owner of another (a person owns at most one). Which workspace a
request acts in is `x-workspace-id`, as before, and the role is the one they hold in *that* workspace, so the
same person is an owner in one request and an assistant in the next.

- **Joining is by invitation** (`invitations` module, `workspace_invitations`). The owner invites a **phone number**
  (`POST /invitations`, role always `assistant` for now): the number is the address because it was verified when
  the person signed up, so whoever signs in with it is who was invited. They need no account yet; the invitation
  waits (14 days, then `expired`, worked out from the date, never stored) and they see it in `GET /invitations/mine`
  with the brand name that is asking (copied onto the invitation, since they cannot read the workspace yet).
  Asking again for a number returns the invitation waiting; at most 20 wait at once; someone who already
  belongs, owner included, is `ALREADY_A_MEMBER`. `POST /invitations/:id/accept|decline` (the invited person),
  `DELETE /invitations/:id` (the owner takes it back), `GET /invitations` (paginated, `?status`). Nobody is
  messaged: the owner tells them, a WhatsApp template can come later.
- **Tenancy of the invitation**: the owner's workspace sees its own rows; a signed-in person can *read* the rows
  addressed to their own number from any workspace (a SELECT-only policy through `app_person_id()`), and
  accepting then happens inside the invitation's workspace in one transaction (claim with
  `UPDATE ... WHERE status = 'pending' AND expires_at > now()`, then make the member), so two answers at once leave
  one winner.
- **The team** (`members`): `GET /members` (owner first), `DELETE /members/:personId` (owner), `DELETE /members/me`
  (leave). The owner cannot be removed or leave (`OWNER_CANNOT_BE_REMOVED`): moving ownership has to come first and no
  such operation exists. Access ends on the next request, because the role is read from the membership every time;
  what the person created stays with the workspace.
- **`can`** (`members/policies/workspace-permission.policy.ts`, the one place). Each route that works on a workspace
  names an action with `@RequireAction(WorkspaceAction.X)`; `WorkspaceActionGuard` (global, after `AuthGuard`) asks
  `MembersService.can` and answers `403 ROLE_NOT_ALLOWED` before the route runs. The **owner** may do everything; a
  **coach who is not the owner** everything except the owner-only actions (`team_manage`, `billing`,
  `workspace_settings`, `business_analytics`); an **assistant** only `member`, clients, subscriptions, payments and
  check-in schedules, read and write: the running of the business, never what clients handed in about their bodies
  (intake answers, check-in answers, progress: `health_data_read`) nor the programmes, forms and libraries
  (`coaching_read|write`), nor packages' prices, settings or billing. A request with no role gets nothing.
- **A new route is closed to assistants until someone decides.** `test/route-permissions.e2e-spec.ts` walks every
  controller and fails for a route that is neither public, nor on its short list of routes that are not about a
  workspace (sign-in, a person's own consents and invitations, becoming a coach, the platform admin screens), nor
  annotated. Add the route to the policy's sets deliberately.
- Not built: inviting a second **coach** (the policy and the column allow `coach`; no endpoint offers it, because
  shared clients between coaches are a different design), moving ownership, per-assistant limits, and a WhatsApp
  message for the invitation.

## Analytics

`analytics` owns no table. `GET /analytics/business` (revenue by month, active clients over time, renewal
rate, average client lifetime, payers, clients at risk) and `GET /clients/:id/progress` (measurements, adherence from check-ins,
`ClientProgressPolicy`) read other modules through their services. Everything is worked out on every read.

## Billing: what coaches pay the platform

`billing` owns `plans_catalog`, `platform_subscriptions`, `platform_invoices` and `platform_admins`. It is
**not** the clients' `subscriptions`: those need freezes and part payments, these run on periods that
roll with a client limit, and one table for both would put a "which kind" on every query.

- **The catalog** (migration `0033`, the product's own pricing from the Deep Dive): `free` (5 clients),
  `basic` EGP 399 (30), `pro` EGP 799 (unlimited), and a yearly version of each paid plan at ten months'
  price. **The Pro price of EGP 799 is my reading of the Deep Dive's table, which lost that cell: confirm
  it.** Changing a price is a new migration. `GET /billing/plans`.
- Every workspace starts on `free` (the onboarding transaction; the migration backfilled the existing
  ones). A free plan has no period (`9999-12-31` stored, `null` returned) and is never past due.
- **The client limit is enforced by the database** (`check_client_limit`, trigger on `clients`): adding a
  client, or **bringing a removed one back**, is refused at the plan's limit with SQLSTATE `GY001`, which
  the global filter turns into `409 CLIENT_LIMIT_REACHED` for the app to answer with an upgrade prompt.
  The plan row is locked while clients are counted, so two additions at once cannot both take the last
  place. A workspace with no plan row has no limit.
- **Money moves outside the system**: a coach asks for a plan (`POST /billing/subscription/change`), the
  platform makes an **invoice** (asking again for the same plan returns it), the coach pays by transfer,
  and a person at the platform confirms it. The free plan costs nothing so it takes effect at once and voids
  waiting invoices; a plan with fewer places than the coach has clients is `PLAN_LIMIT_BELOW_CLIENTS`.
  `GET /billing/subscription` is the plan, its status (past due is **worked out** from the period's end,
  never stored), usage against the limit and any open invoice; `GET /billing/invoices`.
- **The platform's own people** are rows in `platform_admins`, inserted **by hand** by whoever runs the
  deployment (`insert into platform_admins (person_id) select id from people where phone = '+20...'`);
  nothing in the API can make an admin. `PlatformAdminGuard` protects `/admin/billing`: `GET invoices`
  (every coach's, oldest first, `?status`), `POST invoices/:id/mark-paid` (`method`, optional `paidOn`) and
  `POST invoices/:id/void`. They read across workspaces through the **system scope**, which has a policy
  on these two tables as it does on reminders. Confirming is taken atomically (`UPDATE ... WHERE status =
  'open'`), so two people confirming one transfer leave one winner.
- Paying the plan a coach is already on, before it ends, continues from the day after it ends; paying a
  different plan starts it today with **no credit carried over** (a product decision to revisit).
- Not built: the transfer screenshot (`receipt_key` exists), invoices generated automatically as a period
  ends, what happens to a coach who stays past due (the limit simply stays), and an admin screen.

## Tests

Write the failing test first. Unit tests sit beside the code as `*.spec.ts`.
End-to-end tests live in `test/`. Test real behaviour; mock only what you must.

- **HTTP tests** start the whole app with `HttpTestApp.start()` (`test/support/http-test-app.ts`)
  and replace only the outside world: `FakeSupabaseAuth` is a stateful fake of Supabase Auth
  that issues real codes and calls our real, signed Send SMS hook; `FakeSupabaseStorage`
  keeps uploads in memory and, like the real buckets, accepts WebP only; WhatsApp is the
  mock. Everything else, including the database, is real. Use `signedUpPerson()` for a
  signed-in person, `harness.as(session, workspaceId?).get('/path')` to call as them, and
  `trackWorkspace` / `trackPhone` so `stop()` cleans up. Start it in `beforeAll` and
  `afterAll(() => harness.stop(), 60_000)`.
- `test/support/test-env.ts` is loaded for every e2e file (`setupFiles` in
  `test/jest-e2e.json`) and sets the secrets the app needs, so no test depends on the keys
  in `.env` and nothing has to be passed on the command line. Jest gives each test file its
  own `process.env`, so it reaches no other file.
- A test app that calls the hook must be created with `rawBody: true`, as `main.ts` does.
- To prove a test can fail, break the code it covers, run it, and put the code back.
  Check that the break really applied; a pattern that matches nothing proves nothing.

## Pattern skills

`.claude/skills/` and `.agents/skills/` were copied from the BRJ
`profile-service` repo. They describe controller, service, orchestrator and
handler layering, pagination, validators and test tiering. They are the pattern
source, but they were written for TypeORM and for that repo's modules, so
adapt, don't obey blindly: entities become Drizzle schema, and the
`TransactionManager` here is our own. When a skill and this file conflict,
this file wins; propose the skill change instead of quietly diverging.

## Style

Never disable lint rules to resolve a warning; fix the implementation instead.

Follow the `code-comments` skill: comments only where the code cannot say it.
Match the surrounding naming and structure.

Git: the repository is initialised on `main` with `origin` set to
`https://github.com/karim549549/GYM.git`. Nothing is staged or committed yet. Do
not stage, commit or push unless the user asks, in whatever order they say.
