# SHOW UP — Product Requirements Document

**Status:** Draft v0.3 (Netlify-anchored)
**Owner:** Boris
**Live app:** https://boris-showup.netlify.app/
**Last updated:** 2026-05-19

> Revision note. v0.1 was a speculative habit-tracker PRD; v0.2 was revised against the actual live app. v0.3 commits the architecture to the Netlify platform after research (see [NETLIFY_RESEARCH.md](./NETLIFY_RESEARCH.md)). The product remains unchanged; what changes is that the database, API, and (eventually) auth all live inside the Netlify project that already hosts the web app.

---

## 1. Summary

SHOW UP is a daily-principle commitment practice. Each morning the user opens the app, sees a principle to "remember," picks today's focus, and taps **Commit to the day**. A streak counter rewards consecutive days of showing up. The current product is a web-based PWA with browser-local state.

This PRD covers extending that web app to a synced, multi-surface product:

1. **A Netlify-hosted backend.** Netlify DB (Neon Postgres) for storage, Netlify Functions for the API. Same project, same deploy, no second platform.
2. **macOS and iOS widgets.** Native widgets on the home screen, lock screen, and macOS menu bar that show today's principle, the current streak, and let the user commit in one tap.

The web app remains the primary full-screen UI; native apps exist mostly to host widget extensions.

## 2. Why Netlify

The web app is already on Netlify's free tier. Netlify has, in the last twelve months, become a full-stack platform: it ships a managed Postgres database (generally available 2026-04-28), a Functions runtime, a Blobs key-value store, an Edge runtime, and a supported auth product. Every server-side concern this project has can be served from the existing Netlify project, with environment variables wired automatically and one deploy pipeline. There is no second cloud account to manage, no second bill to track, no second platform to learn. See [NETLIFY_RESEARCH.md](./NETLIFY_RESEARCH.md) for the supporting facts.

For native iOS and macOS clients, "Netlify backend" means "the apps make HTTPS calls to `/api/*` on the same domain the web app already lives on." There is no SDK to integrate.

## 3. Current state of the live app

From inspection of https://boris-showup.netlify.app/ and Boris's description: a single-page PWA, deployed on Netlify, installable on iOS via "Add to Home Screen." On load the user sees a streak counter, a "Good morning." greeting, a "Remember this" card with one principle, a "Choose today's focus" picker, a "Commit to the day" button, a "Recent mornings" history, and a "Reset all data" button. State lives in browser `localStorage` — the central limitation this PRD addresses.

Items still to confirm against the source: the full curated list of principles, the rotation logic for the "Remember this" card, the rollover rule for what counts as "a day," and the missed-day behavior of the streak. These are flagged **[to confirm]** below where they matter.

## 4. Problem

The web app works, but its data is fragile and trapped. Clearing browser data wipes the streak. Switching from phone Safari to desktop loses history. Today's principle lives only inside the app — defeating the whole point of a daily practice, which is that the cue should be ambient. A user who has to open the app to remember to open the app is the user who breaks the streak on day three.

A Netlify-hosted backend plus native widgets solves both problems at once: state survives, and the practice meets the user where their attention already is.

## 5. Goals & non-goals

**Goals.** State moves from `localStorage` to Netlify DB without breaking the existing UX. A user on web, iPhone, and Mac sees the same streak and history. Native widgets show today's principle and streak and let the user commit in one tap without launching an app. Native clients work offline; sync is best-effort and conflict-tolerant. The entire stack runs on the existing Netlify free tier for the foreseeable future.

**Non-goals (v1).** Full native iOS/macOS UIs (widgets are the only native surfaces in v1; the web PWA remains the main UI). Social features, public profiles, sharing. Notifications beyond a configurable daily nudge. Editing or authoring custom principles. Android.

## 6. Architecture

```
              ┌──────────────────────────────────────────────────┐
              │              Netlify project (one)               │
              │                                                  │
              │   ┌───────────┐    ┌────────────────────────┐    │
              │   │ Static    │    │ Functions  (/api/*)    │    │
              │   │ web PWA   │────│ commit · streak · me   │    │
              │   └───────────┘    └───────────┬────────────┘    │
              │                                │ @netlify/neon   │
              │                       ┌────────▼────────┐        │
              │                       │  Netlify DB     │        │
              │                       │  (Neon Postgres)│        │
              │                       └─────────────────┘        │
              └──────────────────────┬───────────────────────────┘
                                     │ HTTPS
                  ┌──────────────────┼──────────────────┐
                  │                  │                  │
              ┌───▼────┐       ┌─────▼─────┐      ┌─────▼─────┐
              │ Web    │       │ iOS shell │      │ macOS     │
              │ PWA    │       │ + widget  │      │ shell +   │
              │ (live) │       │ extension │      │ widget    │
              └────────┘       └───────────┘      └───────────┘
```

Every client — web, iOS shell, iOS widget, macOS shell, macOS widget — talks to the same `/api/*` endpoints. There is no client-specific backend.

## 7. Identity strategy (staged)

Authentication is the place where complexity creeps in fastest, so it is staged:

**v0 — anonymous device ID.** On first launch, each client generates a UUID, stores it locally (localStorage on web, Keychain on Apple), and sends it as `X-Device-Id` on every API call. Streaks are per-device. Zero login UX. This is what M2 ships.

**v1 — Sign in with Apple (preferred) or Auth0.** Once the device-ID flow is stable, add real identity so a single user can link multiple devices. The migration is: after sign-in, the server merges device-IDs that belonged to the same person into one `user_id`. Sign in with Apple is the recommended path because it's a single tap on every Apple surface; Auth0 (via its Netlify extension and Auth0.swift SDK) is the fallback if SiwA setup proves heavier than expected.

Skipping auth on day one is the single biggest reason this plan is "low complexity to start."

## 8. Data model

Three tables, all in Netlify DB.

**principles** *(global, curated, server-owned)*
- `id: uuid PRIMARY KEY`
- `slug: text UNIQUE NOT NULL`
- `title: text NOT NULL`
- `body: text NOT NULL`
- `is_active: boolean NOT NULL DEFAULT true`
- `sort_order: integer NOT NULL`

**users** *(populated lazily; one row per device-ID in v0, one row per real account in v1)*
- `id: uuid PRIMARY KEY`
- `created_at: timestamptz NOT NULL DEFAULT now()`
- `auth_provider: text` *(nullable in v0; `'apple'` or `'auth0'` in v1)*
- `auth_subject: text` *(nullable in v0; the provider's stable user ID in v1)*

**device_links** *(maps device IDs to users; lets v0 work and v1 migrate cleanly)*
- `device_id: uuid PRIMARY KEY`
- `user_id: uuid NOT NULL REFERENCES users(id)`
- `first_seen: timestamptz NOT NULL DEFAULT now()`
- `last_seen: timestamptz NOT NULL DEFAULT now()`
- `platform: text` *(`'web'`, `'ios'`, `'macos'`)*

**commitments**
- `id: uuid PRIMARY KEY`
- `user_id: uuid NOT NULL REFERENCES users(id)`
- `principle_id: uuid NOT NULL REFERENCES principles(id)`
- `local_date: date NOT NULL` *(the user's local calendar date — "showing up" is a daily act, so date, not timestamp, is the unique key)*
- `committed_at: timestamptz NOT NULL DEFAULT now()`
- `source: text NOT NULL` *(`'web'`, `'ios_widget'`, `'macos_widget'`, `'ios_app'`, `'macos_app'`)*
- **UNIQUE** `(user_id, local_date)` — one commitment per user per day.

Streaks are **derived**, not stored — computed from the `commitments` table. This avoids invalidation bugs when entries arrive out of order from offline widgets, and it means there is no "streak field" to keep in sync.

## 9. API surface (Netlify Functions)

All endpoints under `/.netlify/functions/` (exposed at `/api/*` via a single `_redirects` rule). All take `X-Device-Id`; v1 adds an optional `Authorization: Bearer <token>` for real auth.

| Method | Path                  | Purpose                                                                                  |
| ------ | --------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/principles`     | List active principles. Cacheable.                                                       |
| GET    | `/api/me`             | Return the calling user's current streak, today's status, and recent commitments.        |
| POST   | `/api/commit`         | Body `{ principle_id, local_date, source }`. Upsert into `commitments`. Returns new streak. |
| DELETE | `/api/commit/today`   | Undo today's commitment. (Reset/edit support.)                                           |
| POST   | `/api/auth/apple`     | *(v1 only)* Exchange an Apple identity token for a server session, merging device-IDs.   |
| POST   | `/api/export`         | Returns the caller's entire history as JSON. (Data-portability.)                         |

Functions run on Node, use `@netlify/neon`, and rely on the auto-injected `NETLIFY_DATABASE_URL`.

## 10. Native client architecture

A single Swift package, **`ShowUpKit`**, contains:

- Codable models matching the API contract.
- A thin `APIClient` wrapping `URLSession` with `X-Device-Id` injection and a bearer-token slot for v1.
- App Intents (`CommitTodayIntent`, `OpenPrincipleIntent`) that target both iOS and macOS widgets.
- A small SQLite cache (via SwiftData) so widgets render instantly without a network round-trip; the cache is refreshed on app foreground, after a successful commit, and on a periodic WidgetKit timeline.

Two thin shell apps — `ShowUpiOS` and `ShowUpMac` — depend on `ShowUpKit`. The iOS shell hosts an iOS widget extension; the macOS shell is a menu bar app with a Notification Center widget extension. Neither shell needs much UI in v1 — the web PWA remains the primary full-screen experience.

## 11. Non-functional requirements

Widget tap to streak-update should feel instant (<200 ms perceived). The Netlify Function round-trip is well within that budget on a normal connection; widgets optimistically update their local cache before the network confirms. Sync conflicts on `(user_id, local_date)` resolve by accepting the earliest `committed_at` — once a day is committed, it stays committed. Offline writes queue locally and flush on next network. The existing web UX, including "reset all data," continues to work; reset now also clears the server-side `commitments` for that device-ID/user, behind a confirmation.

## 12. Privacy

No third-party analytics. Principles are public; everything else is per-user. The web app continues to ask for no information beyond an opaque device ID in v0; v1 adds Sign in with Apple (which exposes only an opaque subject ID by default) or Auth0. The privacy policy commits to not selling, sharing, or mining user data. Account deletion is one click and is destructive.

## 13. Open questions

- Does the existing Netlify site sit on a legacy (pre-Sept 2025) account or the new credit-based plan? Affects free-tier math — check the dashboard during M1.
- Which curated principles ship in the seed table? Lift them from the live web app's source once Chrome (or the JS bundle URL) is reachable. **[to confirm]**
- Does the "Remember this" card on the home screen rotate algorithmically, default to the last committed principle, or do something else? **[to confirm]**
- Streak forgiveness: does a missed day reset to zero, or does the user get a "freeze"? Default to whatever the live app does, document explicitly. **[to confirm]**
- Identity provider for v1: Sign in with Apple or Auth0? Lean SiwA; decide for sure when M3 finishes.

## 14. Milestones

This is the structural milestone list. The practical, smallest-possible-slice ordering of work lives in [BUILD_PLAN.md](./BUILD_PLAN.md), which is the document to follow when actually building.

- **M0 — Audit & confirm.** Read the live app's source, fill in the **[to confirm]** items, decide single Netlify project vs. split.
- **M1 — Netlify backend, anonymous identity.** Netlify DB provisioned, schema migrated, `principles` seeded, four core endpoints (`/api/principles`, `/api/me`, `/api/commit`, `/api/commit/today`) live, web app reading/writing through them behind a feature flag.
- **M2 — Web migration.** Feature flag flipped to default-on; localStorage import on first sync; "reset all data" updated.
- **M3 — `ShowUpKit` Swift package.** Models, `APIClient`, App Intents, SwiftData cache. No UI yet. Built and unit-tested against the live API.
- **M4 — iOS widget + shell.** Sign-in (or device-ID handoff), small/medium/large home widgets, lock screen widgets, commit via App Intent.
- **M5 — macOS widget + menu bar.** Menu bar app, Notification Center widget, shared codebase shakeout.
- **M6 — Auth (Sign in with Apple).** Add `/api/auth/apple`, device-ID-to-user merging migration, sign-in UI on every surface, dual-mode tolerance for a release.
- **M7 — Beta (TestFlight).** 20–30 testers; focus on widget reliability and the SiwA migration.
- **M8 — App Store submission.**

## 15. Success metrics

For v1, success is whether the native widgets meaningfully reduce missed days. Soft targets at four weeks post-launch: median streak length among active users improves vs. the web-only baseline; ≥50% of commits land via widget rather than via the web app; zero reports of lost streaks during the localStorage → Netlify DB migration or the device-ID → SiwA migration.
