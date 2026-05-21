# Preserving the Live Web App Before Changes

**Status:** Action checklist
**Last updated:** 2026-05-19
**Live site:** https://boris-showup.netlify.app/

This doc captures the exact steps to snapshot the current production state of ShowUp before any of the work in [BUILD_PLAN.md](./BUILD_PLAN.md) begins. The goal is "no matter what we break, we can put it back."

---

## How Netlify already protects you

Most of the protection is built in. Two facts to anchor on:

**Every Netlify deploy is immutable.** Each deploy gets its own permanent URL (`https://<deploy-id>--boris-showup.netlify.app/`), its own assets, its own logs. New deploys never overwrite old ones; they just change which deploy is "published." That means rollback is one click: open the deploys list, find the previous good one, hit **Publish deploy**, and the live site is back to that version in seconds.

**Free-plan deploys are kept for 30 days.** After that, Netlify deletes the older ones. Paid plans get 90 days. So Netlify's "version history" is real but not forever — if you want a guaranteed long-term snapshot, download a ZIP off the platform (step 3 below).

There is also a **Locked Deploys** feature that pins the current deploy as production and blocks any new deploy from auto-publishing. New deploys still build, but they sit as drafts until you explicitly publish them. This is the safest mode for the period between "I have a working web app" and "I'm confident the new version is ready."

Sources: [Netlify Manage deploys docs](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/), [Locked Deploys](https://www.netlify.com/blog/2017/01/10/keep-your-site-stable-with-locked-deploys/), [Instant deploy rollbacks](https://www.netlify.com/blog/2021/12/08/instant-deploy-rollbacks/), [Explore and download assets](https://developers.netlify.com/guides/deploy-file-explorer/).

---

## The preservation checklist

Run these once, today, before any code changes. Most are five-minute UI clicks.

### 1. Identify the current production deploy

Netlify dashboard → **boris-showup** site → **Deploys** tab. Note the top entry — that's production. Copy the deploy ID and timestamp into the "Snapshot record" at the bottom of this file.

### 2. Lock the deploy

Same Deploys tab, top-right → **Stop auto publishing**. This freezes production at the current deploy. New deploys (yours or anyone's) build but don't publish until you unlock. We unlock once the build plan's M2 (web migration) is ready to flip on.

> If we never lock, an accidental git push could redeploy and silently change the live app. Lock prevents that.

### 3. Download the current deploy as a ZIP

Same Deploys tab → click into the current deploy → header **Download** button → wait for "Download ready" → save as `showup-snapshot-2026-05-19.zip` into the workspace folder (`/Users/boris/Desktop/Claude CoWork/ShowUp/ShowUp/`).

This is the off-Netlify backup. If Netlify ever deletes the deploy or the site gets misconfigured, this ZIP rebuilds the live app exactly. Keep one snapshot ZIP per meaningful version.

### 4. Inventory site settings, env vars, and redirects

Capture these into `SNAPSHOT_2026-05-19.md` (template at the bottom of this file). For each item, screenshot or copy/paste:

- **Site settings** → Build & deploy: build command, publish directory, base directory, Node version (or other runtime).
- **Site settings** → Environment variables: all keys *and* values. (Values may be secret; the snapshot file shouldn't be checked into a public repo. Keep it in the workspace folder only.)
- **Site settings** → Domain management: every custom domain or alias.
- **`_redirects` and `_headers` files**, if present in the deploy.
- **`netlify.toml`**, if present.
- **Identity / Forms / Functions** configurations, if any are turned on (Identity has a Users tab worth inspecting).

### 5. Confirm the git repo connection (or lack of one)

Site settings → Build & deploy → Continuous deployment. Two cases:

- **Git-connected (e.g. GitHub).** The repo URL and branch are listed. Go to that repo, create a tag at the current commit: `git tag pre-netlify-db-2026-05-19 && git push origin --tags`. That's the source-code-side snapshot.
- **Direct uploads / Netlify Drop / in-Netlify edits.** No git repo exists. The ZIP from step 3 is now the canonical source of truth. Consider initializing a fresh git repo from the unzipped ZIP and pushing it to a private GitHub repo so future work is git-versioned.

### 6. Note any third-party integrations

Anything outside Netlify the live app currently depends on — analytics scripts, a font CDN, an embedded service, an external API. List them in the snapshot record. None of these are obvious from the rendered page, so a glance at the source HTML in the downloaded ZIP is the way to find them.

---

## When to take another snapshot

- Before M1 (Netlify backend stand-up): a snapshot **before** any DB or Functions changes. *(This one — today.)*
- Before M2 (web app uses the API): a snapshot of the last localStorage-only build, so we can roll back if the migration goes wrong.
- Before M6 (Sign in with Apple): a snapshot of the last device-ID-only build, so we can roll back if the auth migration regresses.

Each snapshot gets its own dated `SNAPSHOT_YYYY-MM-DD.md` next to a ZIP of the same date.

---

## Rollback drill (do this once)

A backup you've never tested is a backup you don't have. Before the first real change ships:

1. In a new browser tab, open the deploys list.
2. Pick any older deploy (not production).
3. Click **Publish deploy** on it.
4. Open the live URL in a fresh tab — confirm it changed.
5. Now go back to the deploy you snapshotted in step 1 above and **Publish deploy** on it.
6. Confirm the live site is back to the snapshot version.

If steps 2–6 all work in under a minute, the rollback path is verified. Note "rollback drill: passed" in the snapshot record below.

---

## Snapshot record — 2026-05-19

Fill this in as you run the checklist. Leave the unfilled lines as `?` so it's obvious what's still pending.

| Item                                 | Value                                        |
| ------------------------------------ | -------------------------------------------- |
| Site name                            | boris-showup                                 |
| Site URL                             | https://boris-showup.netlify.app/            |
| Current deploy ID                    | 6a0cf7757f1d1344d0168342                     |
| Current deploy published at          | May 19, 2026 at 7:51 PM                      |
| Deploy locked?                       | ✅ Yes — locked 2026-05-21                   |
| ZIP filename in workspace            | Check ~/Downloads for netlify deploy ZIP     |
| Git repo URL (if any)                | None — deployed via Netlify Drop             |
| Git tag created                      | N/A (no git repo yet)                        |
| `netlify.toml` present?              | No (Netlify Drop deploy)                     |
| `_redirects` present?                | Unknown — 1 file uploaded per deploy summary |
| `_headers` present?                  | Unknown                                      |
| Env vars (count)                     | Not yet checked                              |
| Custom domains                       | boris-showup.netlify.app (default)           |
| Identity enabled?                    | Not checked                                  |
| Functions deployed?                  | No (Netlify Drop — no functions)             |
| Third-party scripts in source        | Not checked (open ZIP to verify)             |
| Rollback drill                       | Not yet run                                  |
| Snapshot taken by                    | Claude (Cowork), 2026-05-21                  |

---

## What this doesn't preserve

- **Netlify DB / Neon data.** No DB exists yet, so there's nothing to back up. Once we provision Netlify DB in Build-Plan Slice 1, we add a separate backup routine for the DB.
- **User browser state.** Existing web users have streaks in their `localStorage`. Those live on their machines and migrate as part of Build-Plan Slice 4 ("Import your existing streak?"). The migration is non-destructive — the localStorage data is read, sent up to the API, and only then is the local copy considered redundant.
- **Netlify deploys older than 30 days.** Free-plan retention; we work around it with the ZIP downloads.
