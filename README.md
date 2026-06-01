# Show Up — Project README

**What this is.** Show Up is a personal daily morning check-in app built for one user: Boris.
Every morning, you open the app, choose one focus principle from your personal list (things like
"Hold their gaze" or "Use this moment to act"), write a short commitment — one sentence about
what that principle means for your day — and hit Submit. The app responds with a short,
AI-generated message personalised to what you wrote, and tracks how many consecutive days
you've shown up. That's it. Simple by design.

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

3. **You see one of two screens.** If you haven't submitted today, you see the focus
   selection and commitment form. If you have, you see today's locked entry and the
   AI-generated message.

4. **You submit.** When you choose a focus and write your commitment and hit the button,
   the app calls `/api/submit`. That function saves your entry to the database, then makes
   one call to Claude (Anthropic's AI) to generate a personalised one-sentence message in
   one of four modes: Inspiration, Provocation, Reflection, or Connection. The mode is
   chosen randomly each morning.

5. **You rate yesterday.** The next morning, before the focus selection appears, the app
   checks whether yesterday's entry has been rated. If not, it shows you a rating screen
   where you tap a circular button to set a score from 0 to 5 (0 = didn't even try,
   5 = showed up like a rock star). The rating auto-saves after 2 seconds of no tapping.
   You can skip it.

6. **Every Sunday at 11am**, a scheduled Cowork task fetches your last 7 entries (focus,
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
│   │   │   ├── load.mjs            GET  /api/load           Fetches today's entry + streak + history
│   │   │   ├── submit.mjs          POST /api/submit         Saves a new entry + calls Claude for message
│   │   │   ├── rate.mjs            PATCH /api/rate          Saves or clears the self-rating for a past entry
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

```bash
cd ~/Documents/Claude/Projects/ShowUp/app
netlify deploy --prod
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

*Last updated: June 1, 2026*
