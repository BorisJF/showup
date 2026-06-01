# SHOW UP

A daily-principle commitment app. Each morning you pick one principle to live by for the day, hit **Commit**, and the streak ticks up. The hardest part of any practice is showing up — this app exists to make that one tap.

## Live app

https://boris-showup.netlify.app/

The web app is a PWA — on iOS, tap Share → "Add to Home Screen" and it launches like a native app.

## What's here today

A single-page PWA, deployed on Netlify, with local-only state (browser localStorage). Core surfaces:

- **Good morning** greeting at the top with the current streak.
- **Remember this** card showing today's principle.
- **Choose today's focus** picker to select which principle you're committing to.
- **Commit to the day** button to lock it in.
- **Recent mornings** history of past commitments.
- **Reset all data** escape hatch.

## What's planned

Native widgets on **macOS** and **iOS** that surface today's principle and streak on the home screen, lock screen, and menu bar — and let you commit with one tap without opening the app. To make this work across surfaces, the project also needs a real database backing the web app, replacing the current localStorage-only state, so streaks and history are durable and shared between web and native clients.

See the docs in order:

1. [PRD.md](./PRD.md) — what we're building and why (Netlify-anchored architecture).
2. [NETLIFY_RESEARCH.md](./NETLIFY_RESEARCH.md) — the research that backs the platform choice.
3. [PRESERVATION.md](./PRESERVATION.md) — snapshot procedure for the live app; run this before any change.
4. [BUILD_PLAN.md](./BUILD_PLAN.md) — the slice-by-slice plan with testing strategy.
5. [log.md](./log.md) — chronological work log; newest entries at the top.
6. [lessons_learned.md](./lessons_learned.md) — curated thematic insights from the log.

## Repo layout

```
ShowUp/
├── README.md              # This file
├── PRD.md                 # Product requirements
├── NETLIFY_RESEARCH.md    # Platform research
├── PRESERVATION.md        # Snapshot procedure for the live app
├── BUILD_PLAN.md          # Incremental build slices + testing strategy
├── log.md                 # Running work log
├── lessons_learned.md     # Distilled insights
└── ...                    # Source lives in the deployed Netlify project (not yet mirrored here)
```

## Status

Web app: shipped and live.
Database backend: not started.
macOS / iOS widgets: not started.

---

_Last updated: 2026-05-19_
