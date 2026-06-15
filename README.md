# Show Up — Project README

**What this is.** Show Up is a personal daily morning check-in app built for one user: Boris.
It runs on a simple framework — **SHOWUP and ACT**. Every morning you pick one of six SHOWUP
focuses for the day, then write one small, concrete thing you'll do to act on it:

- **S** — Smile and be nice
- **H** — Hold their gaze
- **O** — Own it, you can fix it
- **W** — Watch who you're around
- **U** — You, too, deserve kindness
- **P** — Present is where you need to be
- **A** — Act today — the mandatory second step: one specific action that enacts your chosen focus

You choose a focus, write your act as a short "when ___, I'll ___" line, and hit **Show Up!**.
The app responds with a short, AI-generated message personalised to what you wrote, and tracks
how many consecutive days you've shown up. That's it. Simple by design.

**Current features (beyond the core check-in):**

- **Word cloud** — after 10 entries, a "Your words" section appears beneath Recent Mornings. It pulls all past commitment texts, strips stop words, counts frequency, and renders up to 45 words in Georgia serif scaled 14–54px across six warm brown/beige tones. Rendered with a client-side flex layout; no external library.
- **Slide to reset** — a discreet "slide to reset today" control is present in every state (focus picker, act entry, committed view, and the rating screen). Drag the thumb most of the way across to delete today's entry and start over; a short drag springs back. Replaces the old tap-to-confirm reset.
- **Milestone celebration** — at every 10-day mark, a brief particle celebration plays over the committed view, with a short carillon sound. (There is no shareable milestone image — that feature was removed.)
- **"I am special" tap challenge** — a surprise post-submission interstitial that fires on approximately 25% of submissions. See full description below.

**Where it lives.** The app runs at **https://boris-showup.netlify.app** and is hosted entirely
for free on Netlify (the hosting platform) connected to a Neon database (where your entries are
stored). The source code lives on GitHub at **https://github.com/BorisJF/showup**.

---

## How the app works (plain English)

When you open the app in your browser or on your iPhone home screen, here is what happens
behind the scenes:

1. **The frontend loads.** Your browser downloads `app/index.html` — a single file that
   contains the entire visible app: the layout, the fonts, the colours, the buttons, and all
   the logic that makes the page interactive. There is no separate app to install.

2. **The app asks the server for today's data.** As soon as the page loads, it calls
   `/api/load` — a small server-side function running on Netlify — and passes today's date.
   The function queries the database and returns: whether you've already submitted today,
   your current streak count, and your last 7 entries.

3. **You see one of two screens.** If you haven't submitted today, you see the SHOWUP focus
   list. Pick one and it collapses to your chosen focus (with an "or change" option), then a
   single **Act today** field appears, pre-filled with a focus-specific "when ___, I'll ___"
   prompt. If you've already submitted, you see today's locked entry and the AI-generated message.

4. **You submit.** When you choose a focus, write your act, and hit **Show Up!**,
   the app calls `/api/submit`. That function saves your entry to the database, then makes
   one call to Claude (Anthropic's AI) to generate a personalised one-sentence message in
   one of four modes: Inspiration, Provocation, Reflection, or Connection. The mode is
   chosen randomly each morning.

5. **You rate yesterday.** The next morning, before the focus selection appears, the app
   checks whether yesterday's entry has been rated. If not, it shows you a rating screen
   where you tap a circular button to set a score from 0 to 5 (0 = didn't even try,
   5 = showed up like a rock star). The rating auto-saves after 2 seconds of no tapping.
   You can skip it.

6. **"I am special" challenge.** On roughly 1 in 4 submissions, after the bloom animation
   settles, a three-screen interstitial appears over the committed view. First, an offer screen
   invites you to tap a button reading *"I am going to prevail because I am special."* If you
   accept, a 10-second silent countdown begins and you tap the same button as many times as
   possible — each tap plays a short percussive click sound. When time is up, your score is shown
   with a confetti burst and a bright crystalline chord. If you skip, the overlay disappears and
   normal flow continues. The challenge fires at most once per calendar day, tracked in
   localStorage. There is no replay button in the live app.

7. **Every Sunday at 11am**, a scheduled Cowork task fetches your last 7 entries (focus,
   commitment, and rating for each day), writes you a personal reflective letter using Claude,
   and sends it to **borisjf+showup@gmail.com** via Gmail.

---

## Folder structure

Everything in this project lives under one of four top-level folders, plus a few files
at the root that need to be there for technical reasons.

```
ShowUp/
│
├── README.md               ← You are reading this
├── deploy.sh               ← Commits, pushes, and deploys in one step (./deploy.sh)
├── netlify.toml            ← Netlify build configuration (must stay at root)
├── .gitignore              ← Tells git which files to ignore (must stay at root)
├── .claude/                ← Claude Code settings (must stay at root)
│
├── app/                    ← THE LIVE APP — everything Netlify builds and deploys
│   ├── index.html              The entire frontend in one file
│   ├── favicon.png             The small icon shown in the browser tab
│   ├── apple-touch-icon.png    The icon shown on iPhone home screen
│   ├── package.json            Lists the Node.js packages the app depends on
│   ├── package-lock.json       Locks exact dependency versions (auto-generated)
│   ├── schema.sql              Human-readable description of the database structure
│   ├── netlify/
│   │   ├── functions/          Server-side API endpoints (run on Netlify's servers)
│   │   │   ├── load.mjs            GET  /api/load           Fetches today's entry + streak + history + totalCount
│   │   │   ├── submit.mjs          POST /api/submit         Saves a new entry + calls Claude for message
│   │   │   ├── rate.mjs            PATCH /api/rate          Saves or clears the self-rating for a past entry
│   │   │   ├── hint.mjs            POST /api/hint           Rates commitment quality (vague/specific/exceptional)
│   │   │   ├── words.mjs           GET  /api/words          Returns all commitment texts for the word cloud
│   │   │   ├── focus-history.mjs   GET  /api/focus-history  Returns frequency of each focus principle
│   │   │   └── weekly-summary.mjs  GET  /api/weekly-summary Returns last 7 entries for the weekly letter
│   │   ├── lib/
│   │   │   └── streak.mjs          Shared utility: calculates the current consecutive-day streak
│   │   └── database/
│   │       └── migrations/         SQL files that set up or modify the database structure
│   │           └── 20260522.../
│   │               └── migration.sql   Created the "entries" table on May 22, 2026
│   └── tests/
│       ├── unit/               Automated tests that check individual functions in isolation
│       │   ├── load.test.mjs       Tests for the load endpoint
│       │   ├── submit.test.mjs     Tests for the submit endpoint
│       │   └── streak.test.mjs     Tests for the streak calculation logic
│       └── system/
│           └── smoke.sh            End-to-end test: hits the live URL and checks 13 real behaviours
│
├── docs/                   ← Planning and reference documents from the build process
│   ├── prd.md                  Product Requirements Document — what the app should do and why
│   ├── build-plan.md           Technical build plan written before the code was started
│   ├── netlify-research.md     Research notes on Netlify, Neon, and serverless functions
│   ├── setup-guide.md          Step-by-step guide for setting up the project from scratch
│   ├── preservation.md         Notes on how data and settings were preserved during migrations
│   ├── lessons-learned.md      What went wrong, what was fixed, what was learned
│   ├── log.md                  Chronological build log
│   └── readme-original.md      The README that shipped with the first committed version
│
├── knowledge/              ← Plain-language explainer documents (Word format)
│   ├── showup-explainer.docx   4-page plain-language guide: what was built and why
│   └── showup-deep-dive.docx   10-page technical deep-dive, still accessible to a non-technical reader
│
└── _archive/               ← Rollback snapshots — nothing here should ever be deleted
    └── showup-v2-pre-move-2026-06-01.zip
                                Full snapshot of the project taken on June 1, 2026,
                                immediately before the folder was reorganised.
                                To restore: unzip into a new folder and run `npm install` inside `app/`.
```

---

## The database

The app uses a **PostgreSQL database** hosted by Neon, provisioned automatically by Netlify.
You do not manage this database directly — Netlify handles backups and uptime.

The database has one table: **entries**. Each row is one morning's check-in.

| Column | Type | What it stores |
|---|---|---|
| `id` | integer | Auto-generated unique ID for each entry |
| `date` | date | The calendar date of the check-in (e.g. 2026-05-23) |
| `focus` | text | The principle chosen that morning |
| `commitment` | text | What you wrote as your commitment |
| `daily_message` | text | The AI-generated message you received |
| `message_mode` | text | Which mode was used: inspiration / provocation / reflection / connection |
| `rating` | integer (0–5) | Your self-rating of the previous day (set the next morning) |
| `created_at` | timestamp | When the entry was saved |

The database connection is provided automatically by Netlify as an environment variable
called `NETLIFY_DB_URL`. It is never written in the code — Netlify injects it securely
at runtime.

---

## Environment variables (secrets)

The app uses two secret values that are stored securely in Netlify and never appear in
the code or in GitHub. Both are set via the Netlify dashboard or the CLI.

| Variable | What it is | How to set it |
|---|---|---|
| `NETLIFY_DB_URL` | Database connection string — injected automatically by Netlify DB | Managed by Netlify, no action needed |
| `ANTHROPIC_API_KEY` | API key for Claude (Anthropic) — used to generate daily messages | `netlify env:set ANTHROPIC_API_KEY your-key` |

---

## How to deploy

Deploying means publishing your latest code changes so they go live at
**boris-showup.netlify.app**. The app will not update just because you changed a file
on your computer — you have to deploy explicitly.

The easiest way is the **`deploy.sh`** script in the project root. It commits any changes,
pushes them to GitHub, then deploys to Netlify — so the live site and GitHub never drift apart:

```bash
cd ~/Documents/Claude/Projects/ShowUp
./deploy.sh                 # auto commit message with date + time
./deploy.sh "what changed"  # custom commit message
```

If there's nothing to commit it skips straight to deploying. If the push fails it stops before
deploying, so you never publish code that isn't backed up on GitHub.

To deploy manually without the script:

```bash
cd ~/Documents/Claude/Projects/ShowUp
netlify deploy --prod --dir=app
```

The build takes about 15–30 seconds. When you see **"Production deploy is live"**, the
new version is live worldwide.

---

## How to run the tests

**Unit tests** (fast, no internet required, tests individual functions in isolation):
```bash
cd ~/Documents/Claude/Projects/ShowUp/app
npm test
```

**System smoke test** (hits the live URL and checks 13 real end-to-end behaviours):
```bash
cd ~/Documents/Claude/Projects/ShowUp/app
bash tests/system/smoke.sh https://boris-showup.netlify.app
```

---

## Git and version history

Every change ever made to this project is recorded in git. Git is a version-control
system: it takes a snapshot every time you run `git commit`, and you can go back to
any snapshot at any time.

To see the full history of changes:
```bash
cd ~/Documents/Claude/Projects/ShowUp
git log --oneline
```

To push your latest changes to GitHub (so they're backed up remotely):
```bash
git add -A && git commit -m "describe what you changed" && git push
```

---

## Rollback options

If something breaks, you have three ways to go back:

1. **Git history** — the safest and most precise option. Every commit is a restorable
   snapshot. Use `git log` to find the commit you want, then `git revert` or
   `git checkout` to restore it.

2. **Netlify deploy history** — Netlify keeps every previous deploy. You can roll back
   to any past deploy instantly from the Netlify dashboard at
   **app.netlify.com/projects/boris-showup** without touching the code at all.

3. **Archive zip** — a full snapshot of the project as it existed on June 1, 2026,
   lives at `_archive/showup-v2-pre-move-2026-06-01.zip`. To restore from it:
   unzip into a new folder, run `npm install` inside the `app/` subfolder, and deploy.

---

## "I am special" tap challenge

This feature is a surprise interstitial that appears after approximately 1 in 4 daily submissions.

**When it fires.** Inside the submit callback — after the bloom animation, the committed view has rendered, and streak/milestone logic has run — the code evaluates `Math.random() < 0.25`. If the roll passes, and the challenge has not already been shown today (tracked in localStorage under `showup-challenge-YYYY-MM-DD`), the challenge overlay appears after a short delay. The roll happens exactly once per submission.

**The three screens.**

1. **Offer.** Eyebrow text *"Just for today ✦"*, heading *"Something a little different awaits."*, a large dark-brown button with the quote *"I am going to prevail because I am special."*, and a quiet *"Not today →"* skip link. Skipping dismisses the overlay and returns to the normal committed view.

2. **Game.** When the user taps the offer button, a 10-second silent countdown begins (`setTimeout`, no visible timer). A large live tap count is displayed above the same quote button. Each tap plays a short bandpass-filtered noise burst (~40ms, centred at 2200 Hz). Taps register on both `click` and `touchstart` (with `preventDefault`) for reliable mobile performance. When time expires, the button stops responding and the result screen appears automatically.

3. **Result.** The final tap count is displayed large, with the message *"You're truly special. Go and prove it."* A confetti burst fires in the brown/beige palette. A *"Continue →"* button dismisses the overlay. There is no replay button in the live app.

**Sounds — all Web Audio API, nothing hosted.**

| Moment | Sound | Implementation |
|---|---|---|
| Game screen appears | Glockenspiel chime | Two sine-wave oscillators at C6 (1046.50 Hz) and G6 (1567.98 Hz), staggered 0.14s, 8ms linear attack, 0.8s exponential decay |
| Every tap | Percussive click | 40ms bandpass-filtered white noise, centred at 2200 Hz, Q=1.2, sharp amplitude envelope |
| Result reveal | Diamond chord | E6/G6/C7/E7 sine waves (1318/1568/2093/2637 Hz) staggered 0.06s apart, 15ms attack, 1.1s decay, plus a triangle-wave shimmer at 3136 Hz |

The `AudioContext` is initialised on the offer-button tap (a user gesture), which satisfies iOS PWA audio policy. All three sound functions wrap their logic in `try/catch` and fail silently.

---

## Weekly letter (automated)

Every Sunday at 11am Paris time, a Cowork scheduled task named **showup-weekly-letter**
runs automatically. It:
1. Fetches the past 7 days of entries from `/api/weekly-summary`
2. Writes a personal reflective letter using Claude
3. Opens Gmail via the Chrome extension and sends the letter to **borisjf+showup@gmail.com**

The task is managed from the **Scheduled** section in the Cowork sidebar. Claude Cowork
must be open for the task to run on schedule. If Cowork is closed when the task is due,
it runs the next time Cowork is opened.

---

*Last updated: June 15, 2026*
