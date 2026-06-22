# ShowUp — Full Session Summary (June 10 – June 20, 2026)

The complete arc of work on ShowUp across this stretch: a sounds overhaul and three new features (June 10), then a deep reframe of the whole app around **SHOWUP and ACT**, a full **English/French** bilingual layer, a batch of feature fixes and removals, visual reworks, and holographic brand imagery (June 19–20).

A few things built early were later refined or removed as the product evolved — those evolutions are called out below.

**End state:** everything committed, pushed to GitHub, and deployed live. Last commit `0760327`. Service worker at **v23**. No known open issues.

---

# Part 1 — June 10: sounds, features, and the tap challenge

## Sounds overhaul

The app's sounds were broken or low quality. We built an **interactive inline sound gallery** (two volumes of ten synthesized Web Audio sounds each) so Boris could audition options by name before committing. He picked:

- **Submit / commit → "Glacier"** — detuned sine pairs, instant attack, long fade.
- **Rating tick → "Crystal"** — pure high sines on a C6–G6 pentatonic scale.
- **5-star landing → "Champagne"** — an ascending sparkle cascade.
- **Milestone celebration → "Carillon"** — a three-bell tower sequence.

All four `playSoundXxx` functions were rewritten, `TICK_FREQS` updated, service worker bumped to **v12**. *(Later refined June 19 — see the audio reliability fix.)*

## Three new features

1. **Weather-aware greeting** — a tap fetched local weather via geolocation + the Open-Meteo API, with Nominatim reverse-geocoding for the city, shown as a plain subline and cached 30 minutes. *(Removed June 19.)*
2. **Word cloud** — a new `words.mjs` Netlify function returning all commitment texts; the client tokenized, stripped stop-words, and rendered the top 45 words sized by frequency in warm tones, gated behind 10 entries. *(Restyled to "sticker tags" June 19–20.)*
3. **Shareable milestone image** — a 540×540 PNG rendered client-side via Canvas (warm gradient, streak number, tagline), auto-shown at day 7/30/100 and available on demand via a "Share milestone →" button. *(Sharing removed June 19; the separate particle celebration was kept.)*

## "I am special" tap challenge

A three-screen interstitial injected after ~25% of submissions (once per day, localStorage-gated): an **offer** screen, a **10-second tap game** with a live count, and a **result** screen with a confetti burst. Three dedicated Web Audio sounds (glockenspiel on start, percussive click per tap, diamond chord on result). Service worker bumped to **v14**. *(Fully translated to French June 19–20.)*

## Commits & deployment

Changes landed in `index.html`, `service-worker.js`, `load.mjs`, and the new `words.mjs`; the README was updated. Pushed to GitHub (`434c0c1..e095e35`), and Boris ran the Netlify production deploy.

---

# Part 2 — June 19–20: reframe, bilingual, fixes, visuals, icons

## The "SHOWUP and ACT" reframe

The biggest conceptual change. The app moved from "pick a focus + write a free commitment" to a structured daily practice: **pick one of six SHOWUP focuses, then commit to one concrete ACT.** The letters double as the app name:

- **S** — Smile and be nice
- **H** — Hold their gaze
- **O** — Own it, you can fix it
- **W** — Watch who you're around
- **U** — You, too, deserve kindness
- **P** — Present is where you need to be
- **A** — Act today (the mandatory second step)

**Key decisions:**

- **U changed** from "Use this moment to act" to "You, too, deserve kindness" (self-compassion); the old phrase was retired as a focus because ACT became the universal daily constant.
- **ACT is the spine; the focus rotates.** You freely pick one focus each day, and ACT always applies on top.
- **ACT mechanic = "scope it + shrink it"** — captured as one focus-scoped if-then action ("When ___, I'll ___"), small enough to do today. Final form: **one field, focus-specific placeholder, no nudge.**
- **Flow:** focus list → pick collapses to the chosen focus with an "or change" pill → single "Act today" field → **"Show Up!"** banks the day.

The backend contract (`focus` + `commitment`) was kept intact, so streaks, ratings, history, the AI message, and the focus-avoidance alert all keep working. `focus-history.mjs` was synced to the new names. Service worker **v15**.

## English / French bilingual

A full internationalization layer with an EN/FR toggle.

**Key decisions:**

- **Tutoiement (tu)** throughout; **masculine agreement** (Boris is "présent", "gentil", "doux").
- **The S·H·O·W·U·P letters stay as fixed badges**; only the phrases beneath are translated (the acronym doesn't survive translation, so the brand was preserved).
- **Workflow: translate first → preview → code.** Translations were drafted in a Google Doc for Boris to edit before any code.
- Boris's edits introduced a consistent **"se révéler"** ("reveal yourself") metaphor for "show up" across the app.

**Build:** an `I18N` EN/FR dictionary covering every UI string, the six focuses + placeholders, affirmations, milestone messages, rating hints, the challenge, errors, and offline messages; language persisted in localStorage; `fr-FR` dates; the AI daily reflection generated in French (tutoiement) with a French fallback; French stop-words added to the word cloud. Service worker **v18**.

Claude corrected four typos in the draft (Révèle-toi, "Dix jours", a double period, "Va le prouver") and self-translated six strings not in the doc (Recent mornings, Your words, the empty-history line, the word-cloud waiting line, Loading, the connection error) — flagged for review.

## Feature fixes & removals

- **Weather greeting — removed** entirely.
- **Milestone-image sharing — removed** (homepage button + auto pop-ups); the **day-marker particle celebration** was kept.
- **Slide-to-reset** — replaced the tap-to-confirm reset with a discreet "slide to reset today" control, present in **every** state (decision: a slide gesture).
- **Sound reliability bug fixed** — the June-10 sounds sometimes played, sometimes didn't. Root cause: the Web Audio context was blocked by iOS/Safari when a sound fired after a network round-trip (submit chime, milestone bells). Fix: unlock the context on the first user gesture and keep it running, so all later sounds play reliably.
- **Typography** — kept **Lora** but scaled the serif reading text up ~20% (decision: bigger, not a new typeface); added `text-wrap: balance`/`pretty` to kill orphan/runt words. Service worker **v16–v17** across this batch.

## Visual tweaks

- **Rating circle** — the "Tap to rate / Clique pour noter" text moved **inside** the circle, under the number (both themes). In **Papier Tigre**: white face, black ring, Archivo digits matching the greeting.
- **Language toggle placement** — first a discreet bottom footer, then **moved to two tiny US/FR flags at the very top-right** (no text).
- **Word cloud → "sticker tags"** (chosen from three previewed options): soft warm pills in Original; bold flat-color stickers with hard black borders and offset shadows in Papier Tigre. Service worker **v19**.

## Logos & icons (holographic in Papier Tigre)

- **Splash logo — theme-aware**: holographic in Papier Tigre, standard in the default theme (no flash, since the theme is applied before the body renders). Service worker **v20**.
- **Home-screen icon** (`apple-touch-icon.png`) — regenerated 180×180 from the holographic logo. Caveat explained: iOS bakes the icon in at "Add to Home Screen" time, never auto-updates it, and it can't be theme-conditional — so it's one fixed holographic icon, and the home-screen shortcut must be removed and re-added to pick it up. Service worker **v21**.
- **Favicon** — regenerated 100×100 from the holographic logo. Service worker **v22**.
- **Splash background — theme-aware to match each logo's real background**: pure white (`#ffffff`) for the holographic logo, cream (`#fdf9f5`) for the standard logo. Service worker **v23**.

## Tooling, Git & deploy automation

- Found nothing had been committed since the prior session; committed and pushed the SHOWUP/ACT + typography work.
- Created **`deploy.sh`** — one command that commits, pushes to GitHub, then runs the Netlify production deploy, so the live site and GitHub never drift.
- Added **`.claude/`** to `.gitignore` so Claude's local memory files stop being staged.
- **README** updated for the new model, the `deploy.sh` workflow, and the folder structure.

---

## Documents & artifacts produced

- **Google Doc — "ShowUp — French translation (draft)"**: <https://docs.google.com/document/d/13Yl_84N0EgBz1NRk1HlPiydFqM8saJd6Je8TpGiXNVI/edit>
- **`deploy.sh`** — one-step commit + push + deploy script (project root).
- **`README.md`** — updated.
- **This summary** — `SESSION-SUMMARY-2026-06-10-to-06-20.md`.
- **In-chat interactive previews** (ephemeral): the sound gallery (June 10), the SHOWUP/ACT daily flow, font options, the EN/FR bilingual preview, the language-toggle placements, and the word-cloud styles.

## Files touched across the arc

`app/index.html`, `app/service-worker.js`, `app/netlify/functions/submit.mjs`, `app/netlify/functions/load.mjs`, `app/netlify/functions/words.mjs`, `app/netlify/functions/focus-history.mjs`, `app/apple-touch-icon.png`, `app/favicon.png`, `app/logo-holographique-exact.png`, `README.md`, `deploy.sh`, `.gitignore`.

## Service worker version history

**v12** sounds overhaul → **v14** "I am special" challenge (June 10) → **v15** SHOWUP/ACT → **v16** typography → **v17** feature fixes → **v18** bilingual → **v19** visual tweaks + word cloud → **v20** splash logo → **v21** home-screen icon → **v22** favicon → **v23** theme-aware splash background.

---

## Current state

- **Live and fully deployed.** Last commit `0760327`; working tree clean; service worker v23.
- In production: SHOWUP + ACT, the EN/FR toggle (top flags), slide-to-reset, the four chosen sounds now playing reliably, bigger Lora type, the sticker-tag word cloud, the day-marker celebration, the "I am special" challenge (now bilingual), and the holographic splash / home-screen icon / favicon.
- No known open issues.

## Open / optional follow-ups

- **Review the six self-translated French strings** flagged above.
- **iOS home-screen icon** only updates after removing and re-adding the home-screen shortcut.
- **Language-independent focus storage** — focuses are stored in whatever language was active, so switching languages over time mixes the history/word-cloud buckets and splits the monthly focus-avoidance count. Can be made language-independent later if it becomes annoying.
