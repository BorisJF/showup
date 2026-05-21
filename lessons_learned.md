# ShowUp — Lessons Learned

A curated set of insights from working on this project. Distilled from [log.md](./log.md) — the log is chronological, this file is thematic and durable.

## How to use this file

- Update this file after meaningful work (end of a slice, finishing a doc, debugging something hard) — not after every change.
- Group by theme, not by date. The log is for time-ordered narrative; this file is for "what we now know to be true."
- Prefer concrete, falsifiable statements over vibes. Each lesson should answer the implicit question "what should we do differently next time?"
- When a lesson becomes outdated (the platform changed, we changed our minds), edit it in place rather than leaving stale text — and note the revision in the log.

---

## Platform & architecture

**Netlify is now a real full-stack platform, not just a static host.** As of April 2026, Netlify DB (Neon Postgres) is generally available and integrates by injecting `NETLIFY_DATABASE_URL` into Functions automatically. Combined with Functions, this means a previously-static site can grow a database and an API without leaving the platform. For a personal-scale project, the free tier covers everything that matters; deploy frequency is the dominant cost driver, not request volume.

**Native iOS/macOS apps should not connect to Postgres directly.** It's technically possible — Neon exposes both a TCP connection string and an HTTP Data API — but the connection-pooling and credential-rotation story is bad on a mobile client. The clean shape is: native app → HTTPS → Netlify Function → DB. The Function is the contract, and clients are interchangeable.

**Defer authentication for as long as possible.** Anonymous device IDs (a UUID stored in Keychain or localStorage, sent as `X-Device-Id`) let you ship a full backend and a working iOS widget without a sign-in screen. Real identity becomes a clean migration later: when sign-in arrives, the server merges the device IDs that belonged to the same person. This single decision cuts an enormous amount of complexity out of the early slices.

## Preservation & safe changes

**Snapshot before any change to a live system, even when the platform claims to version automatically.** Netlify keeps every deploy immutable and rollback is one click, but free-plan deploys are deleted after 30 days — meaning Netlify's history is short-term safety, not long-term backup. The discipline is: download a ZIP of the live deploy off-platform before any meaningful change, capture env vars and site settings separately (since they aren't in the ZIP), and tag the source repo. The cost is five minutes; the cost of getting this wrong is reconstructing a working site from memory.

**"Lock deploy" before risky work, not after.** Netlify's Stop auto publishing feature pins the live site to the current deploy and turns subsequent deploys into drafts. Turn it on before the work, off when the new version is ready. It's the difference between "an accidental push could overwrite production" and "an accidental push goes to a draft I can review."

**Test the rollback before you need it.** A backup that's never been restored is theatre. Do a one-minute rollback drill — publish an older deploy, confirm the site changed, restore — before the first real change ships. This catches misconfigurations (wrong build settings, missing env vars on the old deploy) while there's still nothing at stake.

## Process & sequencing

**Build vertical slices, not horizontal layers.** Each slice should go from a user-visible action all the way to a row in the database and back. "The database layer" or "the API layer" as standalone deliverables produce nothing demonstrable; a thin end-to-end slice produces something you can show. The pivot moment for this project is Slice 8 — first iPhone widget tap that updates the web app's streak — and everything before it is plumbing toward that single demo.

**Don't write a PRD without seeing the live product first.** The v0.1 PRD I wrote without seeing the live app was a speculative habit-tracker; the actual app is a daily-principle commitment practice. The misalignment wasn't a small detail — it was the entire premise. When the brief is sparse, ask for the URL or a screenshot before inferring; if neither is available, write the inference but mark every assumption as such.

**Mark unverified claims explicitly.** When the source of truth (the live app, in this case) is unreachable, write the doc anyway but tag every unverified statement with **[to confirm]**. It costs nothing to add the tag and saves rereading the whole doc later to figure out what was assumption vs. observation.

## Tooling & environment

**Sandbox network access is allowlisted.** `curl` to netlify.app fails (proxy 403); only the `web_fetch` tool can reach external URLs, and only for URLs that appeared earlier in the conversation. Workaround: ask the user to paste any new URL into chat before fetching it.

**Claude in Chrome can be offline at the start of a session.** First-pass research had to rely on `web_fetch`'s rendered text rather than a live browser. Doable but lossy — JS execution, click-through state, and computed styles aren't available. Plan around it: if Chrome is offline, fall back to rendered HTML + user description; if Chrome is online, prefer it for anything beyond a single static page.

**Knowledge cutoff matters for fast-moving platform docs.** Netlify DB went GA in April 2026 — well after the training cutoff. Web search is the only reliable source for current platform pricing and feature status; don't trust internal recall on anything announced in the last twelve months.

## Product specifics — ShowUp

**The web app's "Add to Home Screen" PWA story implies the user-mental-model is already "this is an app."** That makes the eventual TestFlight build feel like a refinement of the existing surface, not a category change. The transition story for users is "your home-screen icon got better at being an app," not "here is a new product."

**Reset behavior needs to survive the migration.** The live app's "reset all data" button is a meaningful escape hatch users rely on. The Netlify-DB-backed version must keep this working — and now it has to clear server state too, behind a confirmation. Easy to forget; flag explicitly during M5.

**Streak math is the highest-stakes piece of logic in the app.** Get the rollover rule, missed-day behavior, and timezone handling wrong and the user notices instantly because their streak disappears. This is the part of the code that most needs unit tests with a wide range of date inputs.
