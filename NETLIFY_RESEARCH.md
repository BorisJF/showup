# Netlify Platform Research — ShowUp

**Date:** 2026-05-19
**Question being researched:** Can Netlify alone host the database, API, and auth needed to extend the ShowUp web app with iOS and macOS widgets, cheaply and at low complexity? If yes, how?

**Short answer:** Yes. Netlify now ships a managed Postgres database (Netlify DB, generally available since April 28, 2026), a serverless function runtime (Netlify Functions), a key-value/blob store (Netlify Blobs), an edge runtime (Edge Functions), and a still-supported lightweight auth product (Netlify Identity), with Auth0 as the recommended successor for new projects. The whole stack runs from one project and one CLI. For ShowUp, the right minimum-viable shape is: Netlify DB + a handful of Netlify Functions exposing a small REST API, called by the web app, the iOS/macOS apps, and their widget extensions over HTTPS.

This document captures the research the recommendation is based on so future decisions can revisit the underlying facts.

---

## 1. Netlify DB

**What it is.** A fully-managed serverless Postgres database, powered by Neon under the hood. Auto-provisioned when added to a Netlify site; the connection URL is injected into the site's environment as `NETLIFY_DATABASE_URL` and friends, so functions can read/write without secret-management ceremony.

**Status.** Generally available since 2026-04-28.

**How code talks to it.** The first-party path is the `@netlify/neon` npm package, used inside Netlify Functions. It wraps Neon's serverless driver so each function invocation opens a short-lived connection — the right shape for serverless. Standard `pg` and Drizzle/Prisma also work for Node functions.

**Free-tier reality.** Database *storage* is free until 2026-07-01, after which it consumes Netlify credits like every other resource. On the Free plan you get 300 credits per month with a hard cap (no overage, no auto-recharge). For a personal-scale app like ShowUp — a handful of small rows per user per day, single-digit MB of data forever — this is comfortably free.

**Can iOS/macOS connect directly?** Technically yes — Neon exposes a standard Postgres connection string and there's a Neon HTTP Data API that enforces row-level security. In practice, *don't*. A native app holding a Postgres connection string is awkward: connection pooling is poor over flaky mobile networks, schema-level credentials are hard to rotate, and you have no place to put authorization checks. The clean architecture is native app → Netlify Function (HTTPS) → DB, exactly the same way the web app will talk to it.

**Sources:** [Netlify DB docs](https://docs.netlify.com/build/data-and-storage/netlify-database/), [Netlify Database is now generally available](https://www.netlify.com/changelog/2026-04-28-netlify-database/), [Netlify is Now a One-Stop Shop for Building with AI Agents (Neon)](https://neon.com/blog/netlify-db-powered-by-neon), [@netlify/neon on npm](https://www.npmjs.com/package/@netlify/neon), [Switch to Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/switch-to-netlify-database/).

## 2. Netlify Functions

**What it is.** Serverless functions on a Node.js runtime (TypeScript, JavaScript, or Go). Each function is deployed as an addressable HTTP endpoint at `/.netlify/functions/<name>` (or under `/api/*` via redirects).

**Execution profile.** Up to 10 seconds per invocation for standard functions, up to 15 minutes for Background Functions. More than enough for the simple CRUD ShowUp needs.

**Free-tier reality.** On the post-September-2025 credit model, Functions consume credits per GB-hour of compute (10 credits/GB-hour as of April 17, 2026) and per 10K web requests (2 credits/10K). The 300 credits/month free allowance covers thousands of requests at ShowUp's expected volume. Legacy accounts created before 2025-09-04 are still on the older 125,000-invocations-per-month free tier.

**Auth for native clients.** Functions are just HTTPS endpoints. iOS/macOS clients send a Bearer token in the `Authorization` header, the function validates it, and proceeds. For ShowUp the simplest validation is checking an opaque device token issued by the function itself on first run; the most "correct" validation is verifying an Auth0 JWT.

**Sources:** [Netlify Functions docs](https://docs.netlify.com/build/functions/), [Functions usage and billing](https://docs.netlify.com/build/functions/usage-and-billing/), [Netlify pricing page](https://www.netlify.com/pricing/), [Get started with the Netlify API](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/).

## 3. Netlify Edge Functions

**What it is.** A separate runtime based on Deno that executes at Netlify's CDN edge, geographically close to the user. TypeScript/JavaScript only. 50 ms execution budget.

**When you'd use it.** Auth gate at the edge, A/B testing, geo-personalization, request rewriting. Lower latency than regular Functions for the use cases it fits.

**ShowUp relevance.** Probably not in v1. The Function workload — write a row, read a streak — fits the Node Functions model perfectly, and we don't need edge latency. Worth knowing about for later (e.g. caching today's principle at the edge).

**Sources:** [Edge Functions overview](https://docs.netlify.com/build/edge-functions/overview/), [Edge Functions Explained](https://www.netlify.com/blog/edge-functions-explained/), [When to use Functions and Edge Functions](https://answers.netlify.com/t/when-to-use-functions-and-edge-functions/133368).

## 4. Netlify Blobs

**What it is.** A built-in key-value/blob store, edge-cached, eventually consistent by default with opt-in strong consistency. Good for "stash this JSON / image / file by key." Currently in beta but available on all plans.

**ShowUp relevance.** Useful as a low-friction alternative if you decided you didn't want a relational model — e.g. one blob per user containing their full history as JSON. Mentioned for completeness; the relational model in Netlify DB is a better fit for "list of commitments with a unique-per-day constraint" than blobs.

**Sources:** [Netlify Blobs docs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Introducing Netlify Blobs Beta](https://www.netlify.com/blog/introducing-netlify-blobs-beta/), [Blobs pricing forum thread](https://answers.netlify.com/t/blobs-pricing-and-limits/119907).

## 5. Auth: Netlify Identity vs Auth0 vs roll-your-own

**The reversal.** Netlify announced plans to deprecate Netlify Identity, then walked it back on 2026-02-19 after pushback. Identity remains a supported authentication option with no required migration. Netlify is steering *new* projects toward an Auth0 extension instead.

**Netlify Identity.** Free, dead-simple (email + password, magic links, social), but feature-thin and on a "supported but not actively expanded" trajectory. Reasonable for prototypes.

**Auth0 extension.** Free up to 25,000 monthly active users on the new free tier. Has a first-party Swift SDK (`Auth0.swift`) that works on iOS and macOS, with a v3 beta currently shipping. This is what Netlify recommends for new projects.

**Sign in with Apple.** Not a Netlify product, but worth flagging because it's the lowest-friction UX on iOS and macOS (one tap, no email entry, no password). Can be integrated server-side from a Netlify Function — verify Apple's JWT and issue your own session token. More work than Auth0, but feels more native.

**Anonymous device-ID.** Skip auth entirely for v0: each device generates a UUID on first launch and uses it as its identity in the API. Zero login friction. Streaks are per-device, not per-person. This is the right answer for the smallest possible end-to-end slice; real auth gets added once you actually want multi-device sync.

**Sources:** [Netlify + Auth0: Platform extensibility and Identity changes](https://www.netlify.com/blog/auth0-extension-identity-changes/), [Identity plans and pricing](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/plans-and-pricing/), [Auth0.swift on GitHub](https://github.com/auth0/Auth0.swift), [Auth0 iOS / macOS Quickstart](https://auth0.com/docs/quickstart/native/ios-swift), [Auth0 free-tier limits forum](https://community.auth0.com/t/what-happens-if-i-reach-the-free-tier-limits/156968).

## 6. Free-tier accounting for ShowUp specifically

Assuming a personal-scale launch — Boris plus a small beta group, maybe 50 daily-active users by month three — the projected monthly Netlify consumption is roughly:

- **Web requests:** ~50 users × ~10 requests/day × 30 days ≈ 15,000 → ~3 credits.
- **Function compute:** sub-second functions at ~50ms average × 15,000 invocations ≈ 0.2 GB-hours → ~2 credits.
- **Bandwidth:** the existing static site is tiny; native apps send JSON payloads measured in bytes. <100 MB/month → ~2 credits.
- **Deploys:** ~10 deploys/month × 15 credits → 150 credits.

Deploys dominate. The 300-credit cap is comfortable as long as deploy frequency doesn't blow up. If it does, the only meaningful cost is moving to the next plan ($25/month equivalent on current pricing).

**Sources:** [Netlify pricing](https://www.netlify.com/pricing/), [Complete Guide to Netlify Pricing and Plans 2026 (Flexprice)](https://flexprice.io/blog/complete-guide-to-netlify-pricing-and-plans), [Netlify Free Tier 2026 (AgentDeals)](https://agentdeals.dev/vendor/netlify).

## 7. What Netlify does NOT solve for ShowUp

Worth being explicit about the gaps:

- **Native app distribution.** Netlify hosts web. iOS/macOS apps still need the $99/year Apple Developer Program and go through TestFlight → App Store. Netlify is irrelevant to that pipeline.
- **Push notifications.** If ShowUp ever sends a morning nudge to native clients, that needs APNs setup — separate from Netlify.
- **Background sync on iOS.** iOS controls when widget extensions can refresh; Netlify only serves the data they ask for.
- **Local-first storage on devices.** Each native client still needs its own on-device cache (Core Data, SwiftData, or just a plist) so widgets render instantly without a network round-trip.

## 8. Recommendation matrix

| Component         | Recommended choice                         | Why                                                                                       |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Database          | **Netlify DB** (Neon Postgres)             | Free, zero-ops, real relational model, perfect for the small schema ShowUp needs.         |
| API layer         | **Netlify Functions** at `/api/*`          | Same project as the web app, same deploy pipeline, talks to DB via injected env vars.     |
| Web ↔ API         | `fetch()` from the existing static site    | One-line change behind a small data-access module; localStorage becomes a cache.          |
| Native ↔ API      | URLSession over HTTPS to the same `/api/*` | No SDK lock-in; the Function endpoints are the contract.                                  |
| Identity (v0)     | **Anonymous device UUID**                  | Smallest possible slice; no login screen on day one; defers all auth complexity.          |
| Identity (later)  | **Sign in with Apple** (preferred) or Auth0 | One-tap native UX, or fall back to Auth0's Swift SDK if SiwA setup feels heavy.          |
| Native cache      | Core Data / SwiftData on device            | So widgets render instantly. Sync happens in the background via the API.                  |
| Edge functions    | **Not used in v1**                         | No use case yet. Add later if a request needs sub-100ms latency at the edge.              |
| Blobs             | **Not used in v1**                         | Relational schema is a better fit; revisit if we ever need user file uploads.             |

## 9. Open questions to validate during M1

- Does the existing Netlify site sit on a legacy (pre-Sept 2025) account or the new credit plan? Affects the free-tier math; check the dashboard.
- Does the live web app already use any Netlify Function or Form? Affects how disruptive the migration is.
- Do we want one Netlify project hosting both the web app and the API, or split them? One project is simpler and is the recommendation here.

---

**Bottom line.** Netlify can host every server-side concern ShowUp has: a real Postgres database, a real REST API, and (when needed) real auth — all in the project that already exists, all on the free tier for a long time. The native apps don't need to know anything about Netlify beyond "this is the URL we POST to." That alignment is the reason to commit to the Netlify stack rather than introduce a second platform.
