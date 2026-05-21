# ShowUp — Work Log

A running, dated log of work on the project. Newest entries at the top. Each entry: a one-line summary, then the substantive notes. Keep it terse — the log is for "what changed, when, and why," not for narrating every keystroke.

## How to use this file

- Add an entry whenever something changes: docs revised, code written, a question answered, an assumption updated.
- Keep entries dated (`YYYY-MM-DD`). Multiple entries per day are fine.
- Link to the file(s) the entry touches.
- When something turns out to be a generalizable insight, also add a note to [lessons_learned.md](./lessons_learned.md).

---

## 2026-05-19 — Preservation plan written

Added [PRESERVATION.md](./PRESERVATION.md) — a six-step checklist for snapshotting the live web app before any backend work begins. Documented Netlify's built-in deploy versioning (immutable deploys, instant rollback, locked deploys) and the gotcha that free-plan deploys are deleted after 30 days, so an off-platform ZIP download is the long-term backup. Discussed access options with Boris: most preservation work is UI clicks he can do himself; for ongoing work I can drive Netlify via Claude in Chrome with him signed in.

## 2026-05-19 — Testing strategy added; build plan revised

Added a top-level Testing Strategy section to [BUILD_PLAN.md](./BUILD_PLAN.md) and wove a "Tests" subsection into each of the thirteen slices. Three layers defined:

- **Unit tests** — Vitest for Netlify Functions, Swift Testing for `ShowUpKit`, plain JS tests for the web app's data adapter.
- **System tests** — Curl-driven smoke tests against Netlify deploy previews; a "three-surface sync" manual checklist for cross-device behavior.
- **Usability tests** — Scripted via Claude in Chrome: navigate, commit, reload, verify the streak, screenshot. Captured as runnable scenarios in `tests/usability/`.

Also created [log.md](./log.md) (this file) and [lessons_learned.md](./lessons_learned.md) per Boris's request.

## 2026-05-19 — Project anchored on Netlify; three planning docs written

Researched Netlify's full platform (DB, Functions, Edge Functions, Blobs, Identity/Auth0) and committed the architecture to a single Netlify project. Three documents produced:

- [NETLIFY_RESEARCH.md](./NETLIFY_RESEARCH.md) — what each Netlify primitive does, free-tier math for ShowUp's scale, what Netlify doesn't solve (native distribution, push, on-device cache).
- [PRD.md](./PRD.md) revised to v0.3 — architecture diagram, three-table schema, staged identity (anonymous device ID → Sign in with Apple), open questions still to confirm from the live app's source.
- [BUILD_PLAN.md](./BUILD_PLAN.md) — thirteen ordered, end-to-end slices. Pivotal slice is #8 (first working iOS widget tap that updates the web app's streak).

Key decision: **defer auth**. Anonymous device IDs let us ship the entire backend, the web migration, and a working iOS widget before adding Sign in with Apple. Cuts an enormous amount of complexity out of slices 1–8.

## 2026-05-19 — Live web app inspected; PRD rewritten against reality

Boris shared `https://boris-showup.netlify.app/`. Confirmed the app's actual product is a daily-principle commitment practice (not the speculative habit tracker I had assumed in v0.1). Rewrote PRD to v0.2 to match. Flagged items I couldn't verify without the JS bundle (full principle list, rotation logic, streak rollover, missed-day behavior) as **[to confirm]**. Claude in Chrome was offline during this pass, so the inspection used the rendered HTML via web fetch.

## 2026-05-19 — Project scaffolded

Workspace was empty. Created README.md as a starter scaffold; user then asked to infer a PRD. Wrote PRD.md v0.1 — a speculative habit/streak tracker concept that later turned out to miss the mark on what the live app actually does.
