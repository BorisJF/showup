# SHOW UP — Incremental Build Plan

**Status:** Draft v0.2 (testing strategy added)
**Owner:** Boris
**Last updated:** 2026-05-19

This document is the practical companion to [PRD.md](./PRD.md). The PRD is structural ("here is the system we are building"); this is the ordered slice-by-slice plan ("here is what to do next"). Each slice is small, deployable on its own, adds one piece of capability, and ships with the tests that prove it works. You should be able to stop after any slice and have a working, tested product.

---

## Guiding principles

- **One platform, one project.** Everything server-side runs inside the existing Netlify project. No new clouds, no new accounts.
- **No auth in v0.** Anonymous device IDs are enough to ship the entire backend, the web migration, and a working iOS widget. Real identity is a later slice.
- **The contract is the API.** Web, iOS, and macOS clients are different mouths feeding from the same `/api/*` trough. Build the API once; everything else is a client of it.
- **Each slice is end-to-end.** Don't build "the database layer" in isolation — build a vertical slice that goes from a button click all the way to a row in Netlify DB and back.
- **Tests live with the slice.** A slice is not done until the test that proves it shipped with it. The Testing Strategy section below defines the three layers; each slice's "Tests" subsection names the specific ones it owns.

---

## Testing strategy

Tests for ShowUp live in three layers. Different layers run at different speeds, catch different bugs, and answer different questions. The build slices below name which layer each new test belongs to.

### Layer 1 — Unit tests (fast, isolated, run on every push)

Pure-logic tests with no network, no database, no UI. Fail in seconds. The job here is to catch logic bugs at the smallest scope — date math, streak calculation, JSON parsing, App Intent behavior.

**Tools:**

- **Netlify Functions** — [Vitest](https://vitest.dev). Tests live in `netlify/functions/*.test.ts` next to the function they cover. The Neon client is mocked at the module boundary so handlers can be tested without a real database. Pure functions (`computeStreak`, `normalizeLocalDate`) are exercised directly.
- **Web app data adapter** — Vitest in the web project, sharing the runner with Functions. The contract test runs the same suite against both `localStorageAdapter` and `apiAdapter` (with `fetch` stubbed) to prove they're interchangeable.
- **`ShowUpKit` Swift package** — [Swift Testing](https://developer.apple.com/documentation/testing) (the newer framework, not XCTest). Tests cover Codable parsing of API responses, `APIClient` behavior (via a `URLProtocol` stub that returns canned responses), App Intent execution, and the SwiftData cache layer.

**Run them.** Locally via `npm test` and `swift test`. In CI by adding `npm test` to the Netlify build command in `netlify.toml` — a failed test fails the deploy.

### Layer 2 — System / integration tests (medium, run on deploy previews)

End-to-end checks that the deployed system behaves correctly. These hit a real URL with a real database, but they're scripted, deterministic, and cheap to run.

**Tools and where they live:**

- **Curl-driven smoke tests** in `tests/system/smoke.sh`. A shell script using `curl` and `jq` that issues a sequence of API calls against a target URL, asserting JSON responses. Run against deploy previews so production data is never touched.
- **Neon branch isolation per preview.** Netlify Deploy Previews automatically get a Neon database branch when configured via `netlify.toml`. Each PR runs against its own database; the merge to `main` promotes the schema and clears the branch. This keeps integration tests honest without paying for separate environments.
- **Three-surface sync checklist** in `tests/manual/sync-checklist.md`. The one part of the system that genuinely can't be automated cheaply is "commit on phone, see it on Mac." This is a checklist a human runs before beta and after any change to commit logic.

**When they run.** On every deploy preview, before merging to `main`. A red smoke test blocks the merge.

### Layer 3 — Usability tests via Claude in Chrome (slower, exploratory, run on demand)

Driven browser sessions that exercise the live web app like a user would. Used to catch the things automated tests miss: visual regressions, content rendering, the flow feeling right. Scenarios are written as Markdown task descriptions that Claude executes.

**How they work.** A scenario file in `tests/usability/` describes a goal in natural language ("commit to a principle, refresh the page, verify the streak shows 1"). To run it, ask Claude in Chrome to execute the scenario; Claude uses `tabs_create_mcp` → `navigate` → `find` / `read_page` / `javascript_tool` to drive the app, asserts what should be visible, and saves a screenshot to `tests/usability/screenshots/YYYY-MM-DD-<scenario>.png`. If the assertion fails, Claude reports what it saw.

**Why this is worth doing.** Many of ShowUp's bugs will be visual or behavioral: "after committing, the streak still says 0," "the picker doesn't show the seeded principles," "midnight rollover is wrong in PST." These don't surface in unit tests and are tedious to check by hand on every change. Claude-driven sessions let you re-run a dozen flows in a few minutes.

**Initial scenarios to write** (filled in by the slices below):

1. *Cold start*: load the app, verify the structure (greeting, principle card, picker, commit button, streak counter).
2. *First commit*: pick a principle, commit, verify "Recent mornings" updates and streak increments.
3. *Idempotent commit*: commit twice in the same day, verify no double-counting.
4. *Reset and re-commit*: hit "reset all data," confirm zero state, commit again, verify streak goes to 1.
5. *Migration preview*: with localStorage state present, load with `?api=1`, verify the import prompt and the post-import streak.
6. *Cross-device sync*: commit on the web in tab A, refresh tab B (different device-ID), verify they're independent (v0 anonymous behavior). After Slice 12, the post-SiwA version of this scenario verifies they unify.

**When to run them.** After any UI-visible change. Always before flipping the API default (Slice 5). Always before beta (after Slice 11). Spot-check periodically — once a week during active development.

### What we are explicitly not doing

- **No load testing in v1.** ShowUp's expected volume is tiny; the Netlify free-tier credit math in [NETLIFY_RESEARCH.md](./NETLIFY_RESEARCH.md) §6 covers it. If volume grows by 100×, revisit.
- **No browser-matrix testing.** The web app is a small SPA; PWA correctness on Safari iOS is the only matrix slot that matters. Test it manually on actual iPhones during beta.
- **No fuzz testing of the API.** The attack surface is tiny and rate-limited by the Netlify free-tier credit cap; revisit if/when there's anything sensitive in the data.

---

## Slice 0 — Baseline confirmed (½ day)

**Goal.** Verify the things the PRD flagged as **[to confirm]** so the schema and seed data are correct on first try.

1. Open `https://boris-showup.netlify.app/` in Chrome → View Source → copy the script URL → fetch.
2. Extract the principles list verbatim into `seeds/principles.json`.
3. Confirm the streak rollover rule (local midnight? device timezone? UTC?) and document it in PRD §13.
4. Confirm the missed-day behavior (reset to zero vs. freeze) and document it.

**Tests.** *Usability (manual)*: write usability scenario #1 (Cold start) and run it against the live app via Claude in Chrome. The scenario doubles as the act of inspection — Claude's output is the evidence the PRD's open questions are answered.

**Done when.** PRD §13 has no remaining **[to confirm]** items. Usability scenario #1 runs green.

## Slice 1 — Netlify DB exists, seeded, addressable (½ day)

**Goal.** A real Postgres database in the existing Netlify project, with the principles seeded.

1. `netlify db init` from the project root. Netlify provisions Neon Postgres and injects `NETLIFY_DATABASE_URL`.
2. Add `migrations/0001_init.sql` with the four tables from PRD §8. Run via `psql "$NETLIFY_DATABASE_URL" < migrations/0001_init.sql`.
3. Insert from `seeds/principles.json` via `migrations/0002_seed_principles.sql`.
4. Add `tests/system/db-smoke.sh` that runs `psql -c "select count(*) from principles;"` and asserts the count matches.

**Tests.** *System*: `db-smoke.sh` runs and passes. *No unit tests yet* — there's no code under test, only schema.

**Done when.** The database exists, has the schema, contains the seed data, and `db-smoke.sh` is green.

## Slice 2 — First Netlify Function returns the principles (½ day)

**Goal.** Prove the function ↔ DB path end-to-end with the smallest possible endpoint.

1. Create `netlify/functions/principles.ts`. Use `@netlify/neon`, select active principles ordered by `sort_order`, return JSON.
2. Add `_redirects`: `/api/* /.netlify/functions/:splat 200`.
3. Initialize Vitest in the repo (`npm i -D vitest @types/node`).
4. Write `netlify/functions/principles.test.ts`: mock `@netlify/neon`, assert the handler returns the canned rows and a 200.
5. Add `tests/system/smoke.sh` (or extend Slice 1's script) with a curl assertion: `curl /api/principles | jq 'length' > 0`.

**Tests.** *Unit*: `principles.test.ts` covers the handler with a mocked DB client. *System*: smoke.sh adds a real-network check.

**Done when.** `curl https://<deploy-preview>/api/principles` returns the seed data, Vitest is green, smoke.sh is green.

## Slice 3 — Anonymous identity + commit (1 day)

**Goal.** The minimum write path. The web app can persist a commitment to Netlify DB.

1. Add `netlify/functions/me.ts`, `commit.ts`, `commit-today.ts` per PRD §9.
2. Each reads `X-Device-Id`; lazily creates `users` + `device_links` rows if unknown.
3. Extract `computeStreak(userId)` into `netlify/lib/streak.ts` — pure SQL, no state. Window function on `commitments.local_date` counting consecutive days back from today.
4. Add `netlify/lib/dates.ts` with a `normalizeLocalDate(timestamp, tzOffset)` helper. This is the most bug-prone code in the project; test it ruthlessly.

**Tests.** *Unit*:
- `streak.test.ts` — feed `computeStreak` ~15 scenarios: empty history, one commit today, one commit yesterday, gap of one day, gap of two days, commits across DST boundary, commits across year boundary, multiple commits same day (should never happen, but assert idempotence anyway).
- `dates.test.ts` — date normalization across UTC offsets including the user's likely timezone and one across the international date line.
- `me.test.ts`, `commit.test.ts` — handler tests with mocked DB asserting status codes and response shape.

*System*: extend `smoke.sh` to do a full round-trip: generate a UUID, POST a commit, GET `/api/me`, assert `streak === 1`. Run against the deploy preview's isolated Neon branch.

**Done when.** Unit tests pass, smoke round-trip green on deploy preview, the row visible via `psql`.

## Slice 4 — Web app talks to the API behind a flag (1–2 days)

**Goal.** The live web app reads and writes to Netlify DB. Existing localStorage path remains the fallback behind a flag.

1. Add a `dataAdapter` module to the web app with two implementations: `localStorageAdapter` (existing behavior) and `apiAdapter` (calls `/api/*`).
2. Generate and persist a device-ID UUID in localStorage on first run.
3. On boot under `?api=1`, call `/api/me`. If local data exists and server has none, offer "Import your existing streak?" and POST history.
4. Keep "reset all data" working — it now also calls a delete endpoint when the API flag is on.

**Tests.** *Unit*:
- Vitest contract test: one suite, run twice — once against `localStorageAdapter` and once against `apiAdapter` with `fetch` stubbed. Both must satisfy the same assertions (`commit()` then `me()` returns the right streak).

*Usability* (Claude in Chrome):
- Scenario #2 (First commit) — run against `?api=1` on the deploy preview.
- Scenario #3 (Idempotent commit) — same.
- Scenario #5 (Migration preview) — seed localStorage with fake history, load with `?api=1`, verify import prompt, accept, verify streak.

**Done when.** Loading `?api=1` reads/writes via the API. Default URL still uses localStorage and is untouched. Contract test green; scenarios 2, 3, 5 green via Claude in Chrome.

## Slice 5 — Flip the default; the web app is now Netlify-DB-backed (½ day)

**Goal.** Default everyone to the API path. Pre-flight with the full usability sweep.

1. **Pre-flight check**: run the full usability scenario suite (1–6) against the deploy preview. All must pass before the deploy.
2. Remove the `?api=1` gate; `apiAdapter` is the only adapter.
3. Keep an emergency rollback config so a one-line deploy reverts to localStorage.
4. Monitor Netlify Functions logs for a week.

**Tests.** *Usability*: full scenario suite 1–6 must pass before the deploy. After deploy, re-run scenarios 1, 2, 4 against production. *System*: smoke.sh now also runs against production (read-only assertions).

**Done when.** Production is fully on the API. Smoke + scenarios green against production.

## Slice 6 — `ShowUpKit` Swift package (1–2 days)

**Goal.** A shared library that any future iOS or macOS code can use. No app yet.

1. New Swift package `ShowUpKit` with `Models`, `APIClient`, `AppIntents`, `Cache` modules.
2. `Codable` structs matching the API (Principle, Commitment, MeResponse).
3. `APIClient` wrapping `URLSession`, base URL configurable, auto-injects `X-Device-Id` (UUID stored in Keychain).
4. App Intents (`CommitTodayIntent`, `OpenPrincipleIntent`) — declared but minimal, real wiring comes in Slice 8.
5. SwiftData model for the local cache.

**Tests.** *Unit* — Swift Testing:
- `ModelsTests` — decode canned JSON for each API response shape; assert no fields lost.
- `APIClientTests` — `URLProtocol` stub returning canned bytes; verify each method hits the right URL with the right header and parses the right struct out.
- `CacheTests` — SwiftData in-memory container; assert cache writes and reads round-trip.
- `IntentTests` — invoke `CommitTodayIntent.perform()` with a mocked `APIClient`; assert it calls `commit()` once with today's date.

**Done when.** `swift test` is green. No app yet — the package is reusable infrastructure.

## Slice 7 — iOS shell app with one button (1 day)

**Goal.** A minimal SwiftUI iPhone app: show today's principle, let you commit. Foundation for the widget extension.

1. New iOS app target depending on `ShowUpKit`.
2. Single screen: today's principle, current streak, picker, "Commit" button.
3. Personal development team signing — no Developer Program needed yet.

**Tests.** *Unit*: no new logic; the `ShowUpKit` tests still cover everything important. *System*: extend `tests/manual/sync-checklist.md` — add the row "Commit from iPhone app, refresh `https://boris-showup.netlify.app/`, streak visible." Walk through it manually before declaring the slice done.

**Done when.** You can commit from the iPhone app and see it on the web. Sync checklist passes.

## Slice 8 — iOS widget extension (1–2 days) — *the pivotal slice*

**Goal.** Home-screen medium widget showing today's principle and streak. Tap to commit.

1. Widget Extension target. Same App Group as the iOS app for shared SwiftData cache.
2. `TimelineProvider` reads from cache; refresh every 15 min and immediately after a commit.
3. `CommitTodayIntent` (already declared) wired up. Tapping the button triggers the intent → `APIClient.commit` → cache update → `WidgetCenter.reloadAllTimelines()`.

**Tests.** *Unit*:
- `TimelineProviderTests` — feed canned cache state, assert the entries the provider emits.
- *Already-covered*: intent and APIClient logic from Slice 6.

*System*: sync checklist updated — add a row "Commit from iPhone home-screen widget, refresh web, streak visible." Walk through it.

**Done when.** Widget on your iPhone shows today's principle, tap commits, web reflects it on refresh. *This is the moment the whole vision is demonstrable.*

## Slice 9 — More iOS widget sizes + lock screen (½ day)

**Goal.** Round out the iOS widget surfaces.

1. Small and large home-screen variants.
2. Circular and rectangular lock-screen widgets.

**Tests.** *Usability* (manual): visual sweep — each widget in light, dark, and tinted modes on a real device. Capture into `tests/usability/screenshots/widgets/`. No automated visual diff in v1; eyeballs are enough.

**Done when.** Four widget surfaces working on a real iPhone, screenshots filed.

## Slice 10 — macOS shell + menu bar (1 day)

**Goal.** Menu bar `NSStatusItem` showing today's status. Click → dropdown with today's principle and commit button.

1. New macOS app target depending on `ShowUpKit`.
2. `NSStatusItem` with glyph + streak number. Dropdown for content and commit action.
3. Same `CommitTodayIntent`, same `APIClient`.

**Tests.** *Unit*: `ShowUpKit` coverage already applies. *System*: sync checklist now four surfaces — web, iPhone app, iPhone widget, Mac menu bar. Walk through it.

**Done when.** Menu bar commit propagates to all other surfaces.

## Slice 11 — macOS Notification Center widget (½ day)

**Goal.** Same content as the iOS medium widget, in Mac's Notification Center.

Largely re-targeting iOS widget views; SwiftUI on macOS does most of the work.

**Tests.** *Usability* (manual): visual sweep across light/dark on Mac. *System*: sync checklist updated for five surfaces.

**Done when.** macOS widget renders correctly, sync checklist five surfaces green.

## Slice 12 — Sign in with Apple (1–2 days)

**Goal.** Promote anonymous device IDs to real user identity so a single user can use web + iPhone + Mac with one streak.

1. `netlify/functions/auth-apple.ts` — verifies Apple identity token, looks up/creates `users` row, merges existing `device_links` rows.
2. Sign-in screens on iOS, macOS, web (`AuthenticationServices` on native, Apple JS on web).
3. API clients learn to send `Authorization: Bearer <session>` in addition to `X-Device-Id`; server prefers bearer when present.

**Tests.** *Unit*:
- `auth-apple.test.ts` — mock Apple's JWKS, feed a valid-shaped token, assert user creation + device-link merging. Feed an invalid token, assert 401.
- `APIClientTests` updated — both header modes (device-ID-only, device-ID + bearer) tested.

*System*: smoke.sh adds an auth round-trip. *Usability* (Claude in Chrome): scenario #6 (Cross-device sync) — pre-SiwA, post-SiwA, verify the migration is non-destructive.

*Manual*: build up a streak as anonymous on the iPhone, sign in with Apple, verify the streak survives and now appears on web after sign-in.

**Done when.** Three surfaces, one identity, one streak. Unit + system + usability all green. Manual migration verified.

## Slice 13 — Beta + App Store (1–3 weeks elapsed)

**Goal.** Get it in front of real people.

1. Pay $99 Apple Developer Program.
2. TestFlight build for ~20 testers.
3. Bug triage; iterate.
4. App Store submission when the bug list is short.

**Tests.** *Usability*: full Claude-in-Chrome scenario suite re-run weekly during beta. *System*: smoke.sh runs nightly against production via a scheduled GitHub Action or Netlify scheduled function. *Manual*: structured feedback questionnaire to testers (single Google Form), focus on widget reliability and streak correctness.

**Done when.** App Store approves.

---

## What this plan is NOT

- No analytics, telemetry, or third-party error monitoring. Netlify Functions logs + the unit/system/usability test suite are enough for v0.
- No push notifications. APNs is real work; postpone until users ask.
- No Android, no Apple Watch, no iPad-specific layouts beyond what SwiftUI gives for free.
- No multi-user features (sharing, leaderboards, accountability partners).
- No in-app editing of the principles list. Principles ship in the seed table; changes require a deploy.

When tempted to add one of these, ship the current slice first — including its tests.

## Estimated total time to "first end-to-end demo"

Slices 0 through 8 — "I can tap my iPhone widget and see the streak go up in Safari on my laptop, and I have tests proving it" — is roughly **6 to 9 working days** for someone comfortable with Netlify Functions and SwiftUI. The remaining slices (more widget sizes, macOS, SiwA, beta) add another two to three weeks before App Store submission.

The pivotal moment is the end of Slice 8. Everything before it is infrastructure; everything after is polish and expansion. If you have time for one push, push to Slice 8.
