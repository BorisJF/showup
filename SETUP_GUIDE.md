# SHOW UP v2 — Setup Guide

**What this guide covers:** everything from a raw folder of files to a fully working Netlify-DB-backed, Claude-powered app at `boris-showup.netlify.app`.

Estimated time: ~30–45 minutes.

---

## Before you start — snapshot the live site

Your existing app is working. Preserve it before touching anything.

1. Open [Netlify dashboard](https://app.netlify.com) → **boris-showup** → **Deploys** tab.
2. In the top-right corner of the Deploys tab, click **Stop auto publishing**. This freezes production at the current deploy — any new deploy you push will build but not publish until you flip this back on.
3. Click into the top deploy → **Download** button in the header → save the ZIP somewhere safe (e.g., Desktop). This is your off-platform backup.

---

## Step 1 — Create a GitHub repository

The existing site was likely deployed via Netlify Drop (drag-and-drop), which means there's no git repo yet. Netlify DB and Functions require a git-connected site.

1. Go to [github.com/new](https://github.com/new) and create a **private** repo called `showup`.
2. On your Mac, open Terminal and run:

```bash
cd "/Users/boris/Desktop/Claude CoWork/ShowUp/ShowUp"
git init
git add .
git commit -m "feat: SHOW UP v2 — Netlify DB + Claude daily messages"
git remote add origin git@github.com:YOUR_USERNAME/showup.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2 — Connect the GitHub repo to your existing Netlify site

1. In the Netlify dashboard, open **boris-showup** → **Site configuration** → **Build & deploy** → **Continuous deployment**.
2. Click **Link site to Git** (or **Connect to Git provider** if it says that).
3. Choose **GitHub**, authorise Netlify, select the `showup` repo.
4. Set:
   - **Branch to deploy:** `main`
   - **Base directory:** *(leave blank)*
   - **Build command:** *(leave blank)*
   - **Publish directory:** `.`
5. Click **Save**.

> Netlify will trigger a deploy immediately. It will fail because the database and environment variables don't exist yet — that's fine. You locked deploys in Step 0, so the live site is unaffected.

---

## Step 3 — Provision Netlify DB

### Option A — Netlify CLI (recommended)

Install the CLI if you don't have it:

```bash
npm install -g netlify-cli
```

Link your local folder to the Netlify site and provision the database:

```bash
cd "/Users/boris/Desktop/Claude CoWork/ShowUp/ShowUp"
netlify login           # opens browser auth
netlify link            # link this folder to boris-showup
netlify db init         # provisions Neon Postgres + injects NETLIFY_DATABASE_URL
```

After `netlify db init` completes, Netlify has:
- Created a Neon Postgres database attached to `boris-showup`
- Injected `NETLIFY_DATABASE_URL` (and a few other `NETLIFY_DATABASE_*` vars) into the site's environment variables automatically

### Option B — Netlify dashboard

1. In the Netlify dashboard, open **boris-showup** → **Integrations**.
2. Find **Netlify DB** and click **Enable**.
3. Follow the prompts. The connection string is automatically added to your site's environment.

---

## Step 4 — Create the database schema

You need to run `schema.sql` against the Neon database once.

### Get the connection string

```bash
netlify db:exec --help   # check if this command exists
# OR
netlify env:get NETLIFY_DATABASE_URL
```

Copy the value. Then run the schema:

```bash
NETLIFY_DATABASE_URL="<paste the connection string here>"
psql "$NETLIFY_DATABASE_URL" < schema.sql
```

If you don't have `psql` installed:

```bash
brew install libpq
brew link --force libpq
```

**Alternative — Neon console:**
1. In the Netlify dashboard, go to **Integrations** → **Netlify DB** → **Open in Neon**.
2. In the Neon console, open the **SQL Editor**.
3. Paste the contents of `schema.sql` and click **Run**.

Verify it worked:

```bash
psql "$NETLIFY_DATABASE_URL" -c "SELECT COUNT(*) FROM entries;"
# should return: 0
```

---

## Step 5 — Set the Anthropic API key

The daily message feature calls the Claude API from the `submit` function. You need to add your API key as a Netlify environment variable.

**Get an API key:** [console.anthropic.com/keys](https://console.anthropic.com/keys)

**Add it to Netlify:**

```bash
netlify env:set ANTHROPIC_API_KEY "sk-ant-..."
```

Or in the dashboard: **Site configuration** → **Environment variables** → **Add a variable** → key `ANTHROPIC_API_KEY`, value your key.

> The functions use `claude-haiku-4-5-20251001` — fast and cheap. Each submit generates one message of ~30 words. At typical personal use (1 request/day), cost is fractions of a cent per day.

---

## Step 6 — Deploy

Now trigger a deploy with the correct environment:

```bash
netlify deploy --prod
```

Or re-enable auto-publishing in the dashboard:
1. **Deploys** tab → **Start auto publishing**.
2. The most recent build (which was waiting as a draft) will publish immediately.

**Watch the build log.** Look for:
- `@netlify/neon` installed successfully
- Functions bundled: `load`, `submit`
- No errors

---

## Step 7 — Verify the deployment

Open [https://boris-showup.netlify.app/](https://boris-showup.netlify.app/) and check:

1. **Page loads** with today's date and "— -day streak"
2. **Fresh state:** focus input + commitment textarea visible
3. **Submit:** enter a focus, select a principle chip or type freely, add a commitment, hit "Commit to the day"
4. **After commit:** entry locks, a daily message appears (mode label + italic text), streak goes to 1
5. **Reload:** locked state persists (it's reading from the DB)

**Check the Function logs** if something goes wrong:
- Netlify dashboard → **Functions** tab → click `load` or `submit` → **Logs**

Common issues:
- `NETLIFY_DATABASE_URL` not set → re-run `netlify env:set` and redeploy
- `ANTHROPIC_API_KEY` not set → function falls back to "Keep going." (safe), add the key and redeploy
- Schema not created → run `psql "$NETLIFY_DATABASE_URL" < schema.sql` again

---

## Step 8 — Test the rollover with Simulate

At the bottom of the app there's a **"Simulate next day →"** button. Use it to:

1. Submit today's entry normally → streak shows 1
2. Click **Simulate next day** → app reloads as if tomorrow has come → streak shows 1, yesterday's entry appears in Recent mornings → fresh inputs are shown
3. Submit again → streak goes to 2
4. Repeat a few times → verify streak increments correctly
5. Simulate skipping a day (click Simulate twice, don't submit) → verify streak resets to 0

To reset the simulation back to real today: open browser DevTools → Console → type:

```javascript
localStorage.removeItem('dateOffset'); location.reload();
```

---

## Step 9 — Remove the Simulate button before going live

Once you've tested the rollover, remove these lines from `index.html`:

```html
  <!-- SIMULATE NEXT DAY (testing only — remove before going live) -->
  <div class="test-area">
    <button class="simulate-btn" onclick="simulateNextDay()">Simulate next day →</button>
    <div class="simulate-label" id="simulate-label"></div>
  </div>
```

And the JS function:

```javascript
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SIMULATE NEXT DAY (testing only)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function simulateNextDay() {
      const current = parseInt(localStorage.getItem('dateOffset') || '0');
      localStorage.setItem('dateOffset', String(current + 1));
      loadApp();
    }
```

Then deploy:

```bash
git add index.html
git commit -m "chore: remove simulate button"
git push
```

---

## Final file structure

```
showup/
├── index.html                    ← the entire frontend (HTML + CSS + JS)
├── netlify.toml                  ← build config (esbuild, Node 20)
├── package.json                  ← declares @netlify/neon dependency
├── schema.sql                    ← run once to create the entries table
├── netlify/
│   └── functions/
│       ├── load.mjs              ← GET /api/load?date=YYYY-MM-DD
│       └── submit.mjs            ← POST /api/submit
└── (planning docs, etc.)
```

---

## Environment variables summary

| Variable               | Where to get it                       | Required |
|------------------------|---------------------------------------|----------|
| `NETLIFY_DATABASE_URL` | Auto-injected by `netlify db init`    | Yes      |
| `ANTHROPIC_API_KEY`    | console.anthropic.com/keys            | Yes (for daily messages; falls back gracefully if absent) |

---

## How streak math works

The `load` function fetches all entries on or before today (max 100), sorted newest-first, and walks backwards counting consecutive days. A streak is valid if the most recent entry is today or yesterday — if you skip a day, the streak resets to 0 on the next visit.

Streak milestones are displayed as subtle labels next to the number:
- `◇  7-day mark` at 7 days
- `◆  30-day mark` at 30 days
- `✦  100-day mark` at 100 days

---

## Rollback

If anything goes wrong and you need the old app back:
1. Netlify dashboard → **Deploys** tab
2. Find the last deploy before your git-connected deploys
3. Click **Publish deploy**

The live site is back in seconds. Your DB and new Functions are unaffected — they'll be there when you're ready to try again.
