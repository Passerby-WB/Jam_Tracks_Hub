# Jam Tracks Hub — Codex Handoff

## READ THIS FIRST

This is the canonical operational handoff for Codex work in the Jam Tracks Hub production repository. Read it before planning or changing the project. It combines the current checkpoint, architecture contracts, user workflow, safety rules, and relevant skill inventory.

This document does not replace fresh evidence. Values under **Last Verified State** are observations as of the stated date. Refresh them before implementation. Items labelled **Contract / Policy** are durable boundaries and must not be changed without an explicit, scoped user decision.

Authority order when facts conflict:

1. Current `origin/main` and the current production/provider state.
2. Current tracked source, workflows, configuration, and tests.
3. This handoff.
4. Historical docs and conversation records.

Never copy a stale SHA, test count, provider identifier, open-PR state, or release assumption from this file into a new task without checking it.

## New Codex Session — Start Here

1. Read this handoff in full.
2. Read current `AGENTS.md`, project instructions, and every relevant `SKILL.md` exposed in that session. At the last verification there was no repository-local `AGENTS.md` or `SKILL.md`; recheck rather than assuming that remains true.
3. Run the repository identity gate: `pwd`, `git rev-parse --show-toplevel`, `git remote -v`, `git branch --show-current`, `git status --short`, `git rev-parse HEAD`, and `git rev-parse origin/main`.
4. Run `git fetch origin --prune --tags`.
5. Compare `LAST_VERIFIED_MAIN` below with current `origin/main`.
6. Read `package.json` and the workflows/configuration relevant to the task.
7. Inspect the worktree. Preserve the approved local artifacts listed below.
8. If the task involves GitHub, Cloudflare, Umami, Render, or another external platform, review current official documentation and current provider state before relying on old behavior.
9. Perform a read-only architecture and dependency audit for the task.
10. Write an implementation plan.
11. Only then create one dedicated feature branch from fresh canonical `main`.
12. Complete local work and local commits, check main drift, then perform the first push.
13. Own routine CI, Preview, conflict, and PR work through merge readiness.
14. Stop at merge-ready unless the user explicitly authorizes the reviewed PR HEAD to merge.

## Last Verified State

```text
LAST_VERIFIED_AT = 2026-09-06 Asia/Taipei
LAST_VERIFIED_REPOSITORY = Jasper-hsury/Jam_Tracks_Hub
LAST_VERIFIED_MAIN = 0474d11f832fe9ec4f6149a2526f2d4e18e8973c
PACKAGE_VERSION = 2.0.5
LATEST_TAG = v2.0.5
LATEST_RELEASE = v2.0.5 — Vue Frontend Migration Complete
LATEST_TAG_TARGET = 045efd59878e8fe2b8097117cb8ba4809d3573cf
COMMITS_AFTER_LATEST_TAG = 4
VISIBLE_VUE_PAGE_COUNT = 14
VUE_MIGRATION = COMPLETE
LEGACY_CLEANUP = COMPLETE
PHASE_8 = DEFERRED
DAILY_UMAMI = ACTIVE / SECURITY-REMEDIATED / VERIFIED
WEEKLY_UMAMI = FOLLOWUP_REQUIRED
MAIN_RULESET = PROTECT MAIN / ACTIVE
REQUIRED_CHECKS = static-checks; Workers Builds: jamtrackshub
FEATURE_BRANCH_CAN_UPDATE_PRODUCTION = NO
SECURITY_PROGRAM = DEFENSE-IN-DEPTH BASELINE DEPLOYED / VERIFY PER TASK
LAST_VERIFIED_TESTS = 400 / 400
PRODUCTION_WORKER_SOURCE = main at LAST_VERIFIED_MAIN
DEVELOPMENT_LOG_MAIN = 4de879269bbadc8d46430a1d283cb9f19ed11283
```

Fresh verification on 2026-09-06 established that local `main`, `origin/main`, and the active Cloudflare production build all corresponded to `LAST_VERIFIED_MAIN`. The tracked worktree was clean. The latest GitHub Release was `v2.0.5`, but its immutable tag points four commits behind current main; do not move it.

## Product Overview

Jam Tracks Hub is a musician-focused site for original backing tracks, fretboard study, harmony tools, key analysis, and browser-local song preparation. Production is [jamtrackshub.com](https://jamtrackshub.com).

The 14 primary user-facing Vue-owned pages are:

1. Homepage — `index.html`
2. 404 — `404.html`
3. Legal — `legal.html`
4. Privacy — `privacy-policy.html`
5. Service Waking — `service-waking.html`
6. Feedback — `feedback.html`
7. Tracks — `tracks.html`
8. Fretboard Trainer — `fretboard-trainer.html`
9. Chord Progressions — `chord-progressions.html`
10. Scale Explorer — `scale.html`
11. Chord Dictionary — `chord-dictionary.html`
12. Progression Writer — `progression-writer.html`
13. Key Finder — `key-finder.html`
14. Song Workspace — `song-workspace.html`

The production source also contains a static Google verification document and 18 static track-slide documents. Those are not additional Vue product pages.

## Repository / Deployment

### Production repository — Contract / Policy

```text
REPOSITORY = Jasper-hsury/Jam_Tracks_Hub
REMOTE = git@github.com:Jasper-hsury/Jam_Tracks_Hub.git
DEFAULT_BRANCH = main
PRODUCTION_SITE = https://jamtrackshub.com
KEY_FINDER_PUBLIC_API = https://api.jamtrackshub.com
```

Stop immediately if the current repository or remote differs. Never rewrite remotes automatically to make a gate pass.

Node is pinned by `.nvmrc` to `22.23.2`; `package.json` requires Node `>=22.12.0`. Dependencies are locked with `package-lock.json` and installed with `npm ci`.

### Build model — Contract

The frontend is a Vue 3 + Vite multi-page application (MPA), not a Vue Router SPA:

```text
Vite builds 14 visible HTML entries plus a build-only foundation entry
  -> dist/assets/vue contains compiled bundles
  -> tools/scripts/build-cloudflare.js copies retained static assets
  -> tools/scripts/verify-cloudflare-build.js enforces output parity
  -> dist is served by the Cloudflare Worker Static Assets binding
```

`worker.js` runs first only for `/api` and `/api/*`. All other `GET`/`HEAD` traffic falls through to `env.ASSETS.fetch(request)`. `wrangler.jsonc` uses Cloudflare's native `404-page` behavior; do not replace it with SPA fallback behavior.

### Cloudflare branch policy — Contract / last verified

- `main` builds use the normal production deployment path (`npx wrangler deploy`).
- Feature-branch builds use immutable version upload/Preview behavior (`npx wrangler versions upload`).
- A feature branch must not change the active production version or production traffic.
- Do not manually promote or deploy unless that exact action is authorized.
- On 2026-09-06, Cloudflare showed the active deployment at 100% traffic from `LAST_VERIFIED_MAIN`; recent feature branches existed only as preview versions.
- The Cloudflare dashboard still exposed historical Git source links using an older repository identity. Treat provider display metadata as potentially stale; use the verified Git remote and commit identity as authority.

## User Development Workflow

### User preference — Contract / Policy

The user wants Codex to perform the operational engineering work wherever it can be done safely. Codex normally owns:

- current official-platform research and repository architecture audit;
- implementation planning and bounded implementation;
- tests, local validation, explicit staging, and local commits;
- main-drift checks before push and before merge readiness;
- first push after local work is complete;
- remote CI, immutable Cloudflare Preview, PR creation, routine CI fixes, and conflicts;
- merge-readiness preparation.

The user normally handles final review and explicit merge authorization. Do not repeatedly send the user to Terminal, GitHub, or Cloudflare for routine operations Codex can perform safely. Ask only when a material product choice, new authority, authentication step, or destructive/irreversible action genuinely requires the user.

After explicit merge authorization for a verified PR HEAD, Codex may perform the authorized merge, then verify main CI, normal production deployment, and production behavior. Authorization does not automatically extend to a changed PR HEAD.

### Canonical feature flow — Contract / Policy

```text
read-only audit
  -> implementation plan
  -> one dedicated branch from fresh main
  -> local phases and bounded commits
  -> main-drift check
  -> full local validation
  -> first push
  -> required remote CI
  -> immutable Cloudflare Preview
  -> pull request
  -> routine fixes / drift / conflict handling
  -> merge-ready report
  -> STOP for explicit user merge authorization
  -> squash merge when authorized
  -> main CI and normal Cloudflare deployment
  -> production qualification and closeout
```

Human feature, fix, and documentation PRs always stop before merge. The only current narrow exception is the validated machine-generated daily Umami snapshot path described below.

## Git Safety Rules

### Required checks before work

```bash
pwd
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git status --short
git rev-parse HEAD
git rev-parse origin/main
git fetch origin --prune --tags
```

Synchronize `main` only with `git pull --ff-only origin main`. If local main is ahead or diverged, stop. Do not reset it into compliance.

### Forbidden commands/actions — Contract / Policy

Do not use:

- `git reset` or `git reset --hard`
- `git clean`
- `git restore`
- `git stash`
- `git add .`
- force push or `--force-with-lease`
- direct push to `main`
- blind rebase
- blind cherry-pick

Use one task branch. Inspect `git status --short`, `git diff --stat`, and `git diff` before staging. Stage intended files explicitly. Preserve unrelated user changes. Use squash merge for project PRs.

### Approved local artifacts — Contract / Policy

These six untracked local files were approved and present at the last verification:

```text
Translation_Worksheet_zh-TW.md
docs/frontend-style-and-interaction-analysis.md
docs/CLOUDFLARE_FEEDBACK_AND_EMAIL_GUIDE.md
Jam_Tracks_Hub_Security_Completion_Checkpoint.md
Jam_Tracks_Hub_Conversation_Handoff_2026-08-30.md
Jam_Tracks_Hub_Conversation_Handoff_2026-08-30_v2.md
```

Do not edit, delete, move, stage, commit, or add ignore rules merely to hide them. Re-verify the exact inventory every session. Any other unexpected tracked or untracked WIP is a stop condition until ownership and scope are known.

## GitHub Ruleset / Merge Policy

### Last verified on 2026-09-06

The active `Protect main` ruleset targets the default branch and has an empty bypass list. It enforces:

- pull request required before merge;
- conversation resolution required;
- status checks required;
- `static-checks` required;
- `Workers Builds: jamtrackshub` required;
- linear history required;
- squash as the ruleset's only allowed merge method;
- branch deletion protection;
- force-push blocking.

Required approval count is currently zero. This does **not** remove the user's explicit approval policy. GitHub's repository-level **Allow auto-merge** setting is on, but auto-merge must be off for ordinary human PRs.

No bypass, administrator override, required-check weakening, direct-main update, or force push is permitted. If a task appears to require one, stop and report the blocker.

## Skills / Tooling

Skills are environment capabilities, not repository truth. Future Codex sessions must rediscover the available-skills catalog and read the applicable `SKILL.md` files before acting. At the last verification, there were no project-local skill files under this repository.

### Relevant global/session skills last observed on 2026-09-06

| Name | Scope | Purpose | Preconditions / limits | Location |
| --- | --- | --- | --- | --- |
| `update-jam-tracks-hub` | Global personal skill | Publish a new weekly W-number track and package its assets. | **Do not use as-is:** the installed file still names the obsolete `Passerby-WB/Jam_Tracks_Hub` target and older workflow assumptions. Reconcile it with this repository and current workflow before any publication task. It must not modify README analytics. | `$CODEX_HOME/skills/update-jam-tracks-hub/SKILL.md` |
| `jamtrackshub-feedback-export` | Global personal skill | Inspect/count/export Feedback rows from the Cloudflare D1 database. | Requires current Cloudflare access and `SUBSCRIBERS_DB`. Never commit exported feedback or expose private submissions. Console accepts SQL only; Wrangler commands belong in a local terminal. | `$CODEX_HOME/skills/jamtrackshub-feedback-export/SKILL.md` |
| `jamtrackshub-subscriber-export` | Global personal skill | Inspect/count/export subscriber email rows. | The installed skill's URL-query-token example is stale. Current tracked Worker code accepts **Bearer authorization only**. Follow `functions/api/subscribers.csv.js` and current tracked docs; never expose or commit the admin token or exported email data. | `$CODEX_HOME/skills/jamtrackshub-subscriber-export/SKILL.md` |
| `cloudflare` | Global personal skill | Cloudflare Workers, Static Assets, D1, security, deployment, and provider-state work. | Retrieval-first: consult current official Cloudflare docs for changeable APIs, limits, and platform behavior. | `$CODEX_HOME/skills/cloudflare/SKILL.md` |
| `wrangler` | Global personal skill | Use Wrangler for Workers, versions, builds, D1, and secrets operations. | Read before Wrangler commands; verify current syntax. Never print/pass secret values unsafely and never deploy without authorization. | `$CODEX_HOME/skills/wrangler/SKILL.md` |
| `workers-best-practices` | Global personal skill | Review or author Worker code and `wrangler.jsonc`. | Retrieve current official references before Worker changes. Not needed for unrelated frontend-only work. | `$CODEX_HOME/skills/workers-best-practices/SKILL.md` |
| `browser:control-in-app-browser` | Installed plugin skill | Authenticated provider inspection, browser validation, screenshots, and local/Preview testing. | Prefer a connector/API/CLI when it can perform the semantic operation. Never inspect cookies, browser storage, passwords, or unrelated signed-in data. | Installed Browser plugin's `control-in-app-browser/SKILL.md` |

Skill instructions are subordinate to the user's current request and current repository evidence. A stale skill target must never override the repository identity gate.

## Project Memory / Invariants

### Evidence model — Contract

- Source and runtime facts come from current tracked code, tests, builds, and provider state.
- Historical handoffs help locate decisions but are not a substitute for verification.
- A legacy-looking file is not dead merely because Vue exists. Remove only after zero runtime, HTML, import, build, and shared-consumer dependencies are proven.
- Preserve public URLs, metadata, API contracts, local storage schemas, music-domain behavior, accessibility, i18n, theme prepaint, Umami pageviews, and Cloudflare routing unless the task explicitly changes one.
- Keep mutable provider state and long-lived architecture contracts clearly separated.

### Known regressions / hidden gotchas

- Homepage hero animation uses GSAP SplitText after Vue locale rendering and font readiness. Replacing a translated parent node's text after SplitText owns its descendants can destroy animation DOM. Preserve the lifecycle/revert/rebuild sequence.
- A broad site-wide typography normalization was merged and then reverted. Do not reintroduce it as incidental cleanup; typography must be page-scoped and evidence-driven.
- Cloudflare provider metadata and old docs may still show former repository names. The verified Git remote is authoritative.
- `docs/VUE_MIGRATION.md` contains phase-time version language from before the final `2.0.5` alignment. Treat it as migration history, not the current version source.
- The installed track-publishing and subscriber-export skills contain stale operational assumptions. Reconcile them before use.
- Workflow success does not prove the weekly Umami report was produced; its job may safely skip when credentials are unavailable.
- Cloudflare Static Assets omits source files larger than the established 24 MiB build policy. Do not remove or raise this gate casually.

## Vue / Frontend Architecture

### Current architecture — Contract

- Vue `3.5.42`, Vite `8.2.2`, and `@vitejs/plugin-vue` `6.0.8` are locked.
- The site is a multi-page application. Each public root HTML shell owns its stable route, metadata, early theme/locale scripts, page-level Umami loader, retained CSS/scripts, mount element, and one Vue entry.
- `src/app/mountSitePage.js` mounts the shared `SiteShell` plus the page view.
- All 14 primary pages have one entry under `src/entries/` and one Vue-owned page view under `src/views/`.
- The foundation smoke entry remains build-only and is not a fifteenth visible product page.
- There is no Vue Router, Pinia, `vue-i18n`, or VueUse dependency.
- Vite owns the 14 built HTML entries. The static copier preserves retained assets, and the verifier checks output contracts.

The Vue migration and evidence-driven legacy cleanup are complete. Phase 8 routing modernization is optional and deliberately deferred. Do not start it merely because Vue is present, and do not add Vue Router without a real product/SEO/routing objective and separate authorization.

### Proven-dead resources already removed

Do not restore these without new evidence:

```text
scripts/home.js
scripts/tracks.js
scripts/site.js
scripts/i18n.js
src/i18n/useLegacyLocale.js
styles/style.css
```

## Shared Runtime Resources

These classic resources are intentional compatibility/runtime bridges, not cleanup leftovers:

| Resource | Current purpose / consumers |
| --- | --- |
| `scripts/theme-init.js` | Early theme prepaint before Vue mounts. |
| `scripts/i18n-init.js` | Early locale/no-flash initialization before Vue owns reactive localization. |
| `scripts/site-animations.js` | Current GSAP, ScrollTrigger, SplitText/Flip, reduced-motion, theme/locale, and page entrance lifecycle. |
| `scripts/site-config.js` | Service Waking and Key Finder API configuration bridge. |
| `scripts/chord-shapes.js` | Shared `JamChordShapes` music-semantic bridge consumed by Progression Writer and Song Workspace. |
| `scripts/song-workspace-core.js` | Canonical Song Document/domain/parser/transpose/display logic. |
| `scripts/song-workspace-storage.js` | Canonical IndexedDB and preferences implementation. |
| `scripts/song-workspace-import.js` | Canonical bounded JTH import/persistence orchestration. |
| `styles/chord-dictionary.css` | Shared chord-diagram visual contract used by Chord Dictionary, Progression Writer, and Song Workspace. |

Any replacement of `chord-shapes.js` or shared chord diagram CSS requires a repository-wide consumer audit and semantic/visual equivalence. Do not fork page-local chord-shape logic.

## Tracks

### Contract

- `data/tracks.json` is the canonical track-card source.
- There are exactly 18 tracks and 18 static slide pages: `W1`–`W8` and `W10`–`W19`.
- `W9` does not exist and must not be invented.
- W1 retains a direct local PDF download.
- W2–W8 and W10–W19 use canonical local ZIP downloads under `downloads/tracks/`.
- Track card navigation/YouTube behavior and the download-button action are separate contracts; a download click must not trigger card navigation.
- `TracksView.vue`, `TrackCard.vue`, and `tracksData.mjs` own the current Vue behavior: filtering, relative-key groups, sorting, query initialization, GSAP Flip transitions, localization, card navigation, and download resolution.
- Source slide PDFs above 24 MiB are intentionally excluded from `dist`. Static slide HTML is rewritten to the established `https://api.jamtrackshub.com/slides/...` fallback for those embeds. Deployable ZIP downloads remain under the size gate.

Do not change title, number, key, description, YouTube URL, cover, relative-key classification, sort metadata, or filter metadata as an incidental download/build change.

## Song Workspace

### Ownership and local-first model — Contract

`song-workspace.html` is the fourteenth Vue-owned page. `SongWorkspaceView.vue` and `useSongWorkspace.js` own one Vue lifecycle. There is no parallel legacy page controller. The view intentionally reuses the canonical core, storage, import, chord-shape, shared shell, CSS, i18n, and animation bridges.

Song Workspace is browser-local. It has no server-side song storage, sync API, account system, public sharing path, Worker song route, or Render song route. Browser/site-data deletion can remove local songs; backup/restore is the portability mechanism.

### Song Document and storage — Contract

```text
SONG_SCHEMA = jamtrackshub-song
SONG_SCHEMA_VERSION = 2
INDEXEDDB_DATABASE = jamtrackshub-song-workspace
INDEXEDDB_VERSION = 1
INDEXEDDB_STORE = songs
INDEXEDDB_KEY_PATH = id
INDEXEDDB_INDEX = updatedAt
PREFERENCES_KEY = jamTracksHubSongWorkspacePreferences
MAX_STORED_SONGS = 500
MAX_PREFERENCES_READ = 256 KiB
MAX_IMPORT_FILE = 1 MiB
BACKUP_SCHEMA = jamtrackshub-song-backup
BACKUP_VERSION = 1
MAX_BACKUP_SONGS = 500
AUTOSAVE_DEBOUNCE = 500 ms
```

The canonical song contains stable opaque IDs, title/artist, key/capo/display preferences, sections, lyric or instrumental lines, chord symbols, meaningful `anchorPosition` values, and timestamps. Imported songs and restored backups receive new top-level opaque song IDs and timestamps before local persistence/navigation. Do not add a permanent compatibility layer for unsupported pre-release schema records without an explicit migration decision.

### Editing and music-domain behavior — Contract

Preserve all of the following:

- Create modes: Chord + Lyrics, Lyrics Only, and Chords Only.
- ChordPro and JTH JSON import; JTH JSON, ChordPro, TXT, backup, and local print/export paths.
- Stable section/line/chord identifiers and meaningful-position lyric anchors.
- English whitespace tokenization, CJK character tokenization, and mixed-language behavior; punctuation/whitespace do not create independent meaningful positions.
- Lyric and instrumental sections, Global Add, mobile Edit Line handoff, Delete Line, section operations, and My Songs CRUD/duplicate/sort actions.
- Major and minor key sets, capo `0`–`11`, Smart Capo, Shape Key (Traditional Chinese: `演奏指型調性`), enharmonic/theory spelling, and Preserve Input behavior.
- Original, Balanced, Beginner, Roman, and Nashville display modes.
- Shared Shape Picker candidate/order/filter/selection semantics.
- Read Mode, Performance Mode, BPM-linked single-RAF auto-scroll, manual pause/reset, and cleanup.
- Chart Zoom `50`–`150`, Line Spacing `0`–`20`, responsive/mobile layouts, dialogs, focus return, scroll preservation, and print layout.

The maximum input/domain bounds in `song-workspace-core.js` are security and reliability limits, not styling details. Review them before parser, import, or schema work.

## NO_LYRICS_EGRESS

### Highest-priority privacy contract

User-created song content must never leave the browser. Protected content includes, at minimum:

- song title and artist;
- lyrics and section titles;
- chord symbols, chord locations, and anchors;
- ChordPro, JTH JSON, Song Document, imported file content, and backup content;
- local-library contents, sensitive filenames/import metadata, and identifiers that reveal content.

It must not enter:

- path, query, hash, referrer, or other URL state;
- `document.title`;
- Umami event names, properties, custom events, or other analytics payloads;
- Worker, Feedback, Subscriber, Key Finder, Render, or any third-party request;
- remote error reporting, logs, session replay, DOM capture, or telemetry.

The only permitted Song Workspace URL state is an opaque validated `?song=<id>` identifier. The page title stays fixed/localized and content-free. Its Umami loader is page-level only and sets search/hash exclusion. There are no custom Song Workspace analytics events. Exports use local Blob/Object URLs or the browser print path.

Privacy testing must use synthetic canaries only. Never inspect, import, export, mutate, or delete real user Song Workspace data. A privacy canary failure is an immediate stop condition.

## Key Finder

### Production architecture — Contract

```text
Browser Vue UI
  -> https://api.jamtrackshub.com
  -> Cloudflare DNS / TLS / WAF / rate-limiting controls
  -> existing Render service
  -> FastAPI + ffmpeg + yt-dlp + trained analysis models
```

The frontend must not silently fall back to a generated Render hostname. Production API origin resolution lives in `scripts/site-config.js` and `src/services/keyFinderApi.mjs`; saved API overrides are honored only on local hosts and removed on production hosts. A local YouTube Helper fallback may be used by the browser workflow when the protected site analyzers cannot process a link; it is not a public production-backend fallback.

Current routes are:

| Route | Method | Role |
| --- | --- | --- |
| `/api/health` | GET | health/wake status |
| `/api/analyze` | POST | legacy synchronous URL analysis |
| `/api/analyze/jobs` | POST | YouTube analysis job creation |
| `/api/analyze/jobs/{job_id}` | GET | YouTube job polling |
| `/api/analyze-file/jobs` | POST | upload analysis job creation |
| `/api/analyze-file/jobs/{job_id}` | GET | file job polling |
| `/api/analyze-file` | POST | legacy synchronous file analysis |

The Cloudflare zone applies the protected public domain and route-specific controls before Render. Containers remain deferred. Do not create real production analysis jobs during ordinary regression tests; use health checks, source tests, mocks, or an explicitly authorized bounded synthetic job.

## i18n / Theme / Animations

### Contract

- English and Traditional Chinese locale JSON live under `locales/`.
- Reactive Vue localization uses `src/i18n/useSiteLocale.js`.
- The language preference key is `jasperMusicLanguage`.
- Early `scripts/i18n-init.js` remains to avoid a language flash; it is not a parallel Vue DOM owner.
- Early `scripts/theme-init.js` remains to avoid a theme flash.
- Vue owns page content and the shared shell; Vue-owned page content must not be independently mutated by obsolete `data-i18n` controllers.
- `site-animations.js` remains a live bridge and must be coordinated with Vue mount/locale lifecycle.
- Preserve light/dark behavior, reduced motion, responsive navigation, focus states, semantic labels, and fixed metadata/canonical URL contracts.

## Cloudflare

### Static site and Worker API boundary — Contract

The `jamtrackshub` Worker serves `dist` through a Static Assets binding and exposes only these site-Worker API functions:

- `POST`/`OPTIONS /api/subscribe`
- `POST`/`OPTIONS /api/feedback`
- `GET /api/subscribers.csv`

Unknown `/api/*` routes fail closed. Non-static methods outside the API return method-not-allowed. API responses receive no-store and security headers.

Subscriber and feedback submissions use the D1 binding named `SUBSCRIBERS_DB`. Feedback has no public CSV endpoint; use an authorized D1 Console/Wrangler export and keep exported private data out of Git. Subscriber CSV export requires `Authorization: Bearer ...` against `/api/subscribers.csv`; query-string tokens are not supported by current source and must not be documented as canonical.

The frontend CSP permits current self-hosted resources, the established Umami script/connect origins, and the protected Key Finder API origin. Do not add wildcards, `unsafe-eval`, broad `connect-src`, or a second telemetry provider. Do not change D1, Worker, or Key Finder boundaries during unrelated frontend work.

### Security program status — Last verified / contract

The current defense-in-depth baseline is deployed: same-origin request enforcement, bounded JSON body reads, form honeypots, generic fail-closed API errors, no-store API responses, timing-safe subscriber-token comparison, CSP/security headers, Cloudflare protection for the Key Finder domain, protected `main`, required CI, and secret-only Umami capability handling. Provider-side WAF/rate/bot settings are external mutable state and must be checked fresh for security work.

Public documentation may describe security only at a high level. Do not publish exact provider rules, thresholds, credentials, bypass logic, internal detection logic, or forensic log content. A previously completed security phase is not permission to assume every future source/provider state is unchanged.

## Umami Architecture

### Three separate systems — Contract

Do not conflate these systems or fix one while casually changing another:

1. **Page analytics:** root HTML pages load the existing Umami script for bounded pageviews. Song Workspace additionally excludes search/hash and has no content-bearing custom events.
2. **Daily README screenshot:** captures a capability-protected dashboard view, validates a PNG and exact README marker block, creates/updates a machine PR, and may auto-squash only after all hard gates.
3. **Weekly API report:** attempts to generate a Markdown analytics issue report from Umami API credentials. It is currently an unresolved follow-up and is not part of the working daily architecture.

### Daily snapshot — Last verified / contract

The daily workflow is `.github/workflows/umami-readme-screenshot.yml`, scheduled once daily and also manually dispatchable. Its current production cycle is:

```text
scheduled run from main
  -> validate and mask protected Share credential
  -> capture and validate bounded dashboard PNG
  -> validate README marker-only change and dated history image
  -> use repository-only GitHub App token
  -> create or update one machine PR
  -> static-checks + Workers Builds: jamtrackshub
  -> GitHub native automatic SQUASH merge
  -> main normal Cloudflare production build
  -> delete the automation branch after verified merge
```

Dry-run and production identities are isolated:

```text
automation/umami-readme-snapshot-dry-run-YYYY-MM-DD
automation/umami-readme-snapshot-production-YYYY-MM-DD
```

A closed dry-run cycle must never suppress, contaminate, or donate branch/PR identity to a production cycle. A closed unmerged production cycle with identical content follows the intentional production suppression policy. At most one open production snapshot PR may exist.

The machine PR hard gates include repository/base/head identity, App actor, production/dry-run mode, workflow provenance, exact file allowlist, README marker-only mutation, valid bounded PNGs, verified App-created commits, mergeability, required checks, and no bypass. The automation never direct-pushes `main`, never force-pushes, never calls an administrator merge, and never weakens rules.

The App is repository-scoped. Its operating contract is metadata read plus Contents and Pull Requests read/write, with no administration/ruleset/bypass capability; the workflow requests only the write permissions needed for repository content and PR operations. Re-verify the live App permissions before changing this automation.

The narrow auto-merge exception applies only to this validated App-authored snapshot PR. All human PRs, including docs and analytics-maintenance PRs, require explicit user merge authorization.

On 2026-09-06 the workflow was enabled, required repository secrets were present by name, repository variables were empty, the GitHub App was installed on this repository, and the latest controlled post-remediation run completed successfully. Its cycle result was `CYCLE_ALREADY_CLOSED` because that day's production cycle had already completed; this was not a `NO_DIFF` claim. A previous controlled production cycle had already proven PR creation, required checks, native squash, main integration, and production deployment.

### Weekly report — Open follow-up

The workflow is `.github/workflows/umami-analytics.yml`. Its latest visible scheduled run on 2026-08-31 was green only because the report safely skipped: required API access was not configured. Known work to re-audit against current official Umami Cloud documentation includes authentication/header assumptions, API endpoint compatibility, metrics paths, comparison schema, and required credentials.

Do not modify the working daily snapshot system while fixing the weekly API report unless the user explicitly scopes both.

## Umami Security Incident / Lessons

### Resolved incident record — No capability values included

In September 2026, historical GitHub Actions logs were found to contain a private Umami dashboard Share capability because a repository-variable fallback and step environment handling allowed it to appear in runner output. The response:

- disabled the daily workflow while containment was in progress;
- invalidated the old capability and replaced it with a repository secret;
- removed the public repository variable;
- deleted log archives for all 48 confirmed affected workflow runs while retaining run metadata/history;
- added early explicit masking and fail-closed credential validation;
- added focused synthetic non-disclosure tests across success and failure paths;
- performed a controlled production qualification with no capability visible in retained logs;
- re-enabled the daily workflow.

The replacement credential contract is:

- repository **secret** only, never repository variable;
- secret name may appear in code/docs, but its value never may;
- never print, echo, serialize, pass through outputs/environment files, put in README/PR/commit/artifact/frontend, or include in remote error text;
- validate and register masking before dependency installation, token creation, browser capture, or other risky steps;
- fail closed before API, capture, branch, PR, or auto-merge activity when missing/invalid;
- use synthetic capability canaries in tests.

Do not reopen the resolved daily incident or redesign the automation without current evidence of a new problem. New log retention must remain content/capability-safe.

## Version / Release Policy

### Contract / Policy

Every future task must classify:

```text
VERSION_IMPACT = NONE | PATCH | MINOR | MAJOR
```

Use the actual public contract. Internal parity, refactor, test, documentation, or maintenance work may be `NONE`. Do not bump `package.json` automatically. Do not create or move a tag, create a GitHub Release, or claim a release is live without explicit scope and authorization.

Current version is `2.0.5`. The published `v2.0.5` tag and Release point to the Vue legacy-cleanup commit, before the later package alignment and Umami security/automation commits. This history is intentional. Published tags are immutable unless the user explicitly directs otherwise; do not move `v2.0.5` to current main.

## Development Log Repository

### Cross-repository boundary — Contract / Policy

`Jasper-hsury/Jam_Tracks_Hub_Development_Log` is a separate public historical product. It is **not** the source, backend, build, or deployment repository for Jam Tracks Hub.

When the user requests a Development Log update:

```text
TARGET_REPOSITORY = Jasper-hsury/Jam_Tracks_Hub_Development_Log
PRODUCT_EVIDENCE_SOURCE = Jasper-hsury/Jam_Tracks_Hub (read-only)
```

Use a dual-repository evidence model. Do not modify Jam Tracks Hub while merely updating its Development Log. Do not copy private operational details, user song data, credentials, defensive thresholds, or incident forensics into the public log.

Last verified on 2026-09-06: the Development Log was public, its `main` was `4de879269bbadc8d46430a1d283cb9f19ed11283`, and its latest commit was “data: extend Jam Tracks Hub history through v2.0.5 (#5)”. Refresh this before future log work.

## Testing / Validation

### Canonical local validation — Contract

Use the commands that exist in current `package.json`; do not assume an old count:

```bash
npm ci
npm test
npm run check
npm run build:cloudflare
npm run verify:cloudflare
git diff --check
```

`npm run build:cloudflare` already invokes the verifier once, but run `npm run verify:cloudflare` explicitly when the task requires the canonical gate. Report the exact current test count from the run.

Tests cover Vue ownership/parity, navigation, responsive behavior, shared shell, Tracks, music-domain fixtures, Song Workspace schema/storage/import/privacy, Worker/D1 security, and Umami snapshot contracts. Browser validation must be proportional to the change and use immutable Preview when available. Never mutate production Feedback/D1, create real Key Finder jobs, or inspect real Song Workspace data just to produce a smoke result.

### Remote gate — Contract

Before declaring a normal PR ready:

- PR is open and its reviewed HEAD is unchanged;
- `static-checks` passes;
- `Workers Builds: jamtrackshub` passes;
- immutable Preview matches the pushed HEAD when a Preview exists;
- feature branch did not change production;
- mergeable with no conflicts;
- all review conversations are resolved;
- auto-merge is off;
- no unresolved blocker remains.

Then stop for explicit user merge approval.

## Open Follow-Ups / Deferred Work

Only the following were verified as current on 2026-09-06:

1. **Weekly Umami Analytics Report:** credentials/API compatibility must be re-audited against current official Umami Cloud documentation. It currently skips safely rather than producing a report.
2. **Phase 8 / routing modernization:** optional and deferred. Vue migration does not require Vue Router.
3. **Stale repository-name references:** some historical README/docs/provider links still refer to former repository identities. Treat this as bounded documentation/provider-metadata cleanup, not authorization to rewrite remotes or deployment integrations.
4. **Installed personal skill drift:** `update-jam-tracks-hub` and `jamtrackshub-subscriber-export` need reconciliation with the current repository and Bearer-only export contract before reuse.
5. **Development Log freshness:** its current history reaches `v2.0.5`, but later package-alignment and Umami automation/security milestones may require a separately authorized, high-level log update.
6. **GitHub Actions runtime warning:** the current GitHub App token action emitted a Node 20 deprecation warning while GitHub forced it onto Node 24. The workflow still passed; track the pinned upstream action and update it only through a tested, bounded dependency change.

Do not list a resolved item as open simply because old docs still describe its earlier phase.

## Resolved / Stable — Do Not Reopen Casually

- Vue 3/Vite MPA migration across all 14 primary pages.
- Evidence-driven removal of the six proven-dead legacy frontend resources.
- Tracks W2–W8 normalization to the established ZIP download model.
- Key Finder frontend Vue takeover while retaining the Cloudflare-protected Render backend.
- Song Workspace Vue takeover while retaining Song Document v2, IndexedDB v1, and `NO_LYRICS_EGRESS`.
- `package.json` alignment to `2.0.5`.
- Daily Umami failure under direct-main restrictions, replaced by validated PR-based automation.
- Daily Umami machine PR/native auto-squash architecture.
- Dry-run/production same-day branch and cycle isolation.
- Umami Share capability log-exposure incident containment and secret-only remediation.

Reopen a stable area only with fresh reproducible evidence or an explicit new product objective.

## Mandatory Stop Conditions

Stop and report rather than silently fixing forward when any of these occurs:

- repository identity or remote mismatch;
- local main ahead/diverged;
- unexpected tracked or unapproved untracked WIP;
- authorized PR HEAD changed;
- main drift would require changing the reviewed HEAD after merge authorization;
- secret, private capability, token, key, cookie, or private-data exposure;
- Song Workspace privacy canary or `NO_LYRICS_EGRESS` failure;
- unexpected Song Workspace schema, IndexedDB, preference-key, or storage behavior drift;
- unexpected production promotion from a feature branch;
- required-check bypass, ruleset weakening, administrator merge, direct-main push, or force push would be needed;
- destructive cleanup target is uncertain;
- a shared consumer cannot be proven safe;
- real user data would need to be inspected, changed, exported, or deleted;
- external provider state materially contradicts the proposed architecture;
- the task would require embedding a secret/private value in documentation.

## Privacy / Secret Operating Rules

- Never print or echo secret values.
- Never put credentials or private capability URLs into frontend source, repository variables, docs, logs, PR bodies, commits, artifacts, or screenshots.
- Use least-privilege, repository-scoped credentials.
- Use constant-time secret comparison where applicable.
- Use synthetic data for privacy/security tests.
- Do not inspect real user Song Workspace content, feedback, subscriber email data, or browser storage unless the user explicitly authorizes a bounded operational task and it is necessary.
- Exported feedback/email files are private operational data and must never be committed.

## Major Recent Milestones

This is an architectural chronology, not a complete changelog:

| Date | Milestone |
| --- | --- |
| 2026-08-29 to 2026-08-30 | Key Finder production traffic moved behind `api.jamtrackshub.com` and Cloudflare protection while retaining Render/FastAPI analysis. |
| 2026-08-31 | Song Workspace received bounded page-level Umami tracking with search/hash exclusion and `NO_LYRICS_EGRESS` tests. |
| 2026-09-02 to 2026-09-04 | Vue/Vite MPA migration progressed through shared/static pages, Homepage/Tracks, music tools, Key Finder, and Song Workspace. |
| 2026-09-03 | W2–W8 downloads were normalized to the established deployable ZIP architecture. |
| 2026-09-05 | Evidence-driven legacy cleanup completed; `v2.0.5` tag/Release published; package metadata aligned afterward. |
| 2026-09-06 | Daily Umami automation moved to validated App-authored PRs with native squash, dry-run/production isolation, and normal main deployment. |
| 2026-09-06 | Umami Share capability incident was contained; affected logs were removed, secret-only masking/fail-closed handling shipped, and the daily workflow was safely re-enabled. |

## Fresh Verification Checklist by Task Area

Before implementation, refresh the items that match the task:

- **All tasks:** repository identity, worktree, `origin/main`, current branch, current version, relevant tests/configuration, and approved local artifacts.
- **Release work:** package version, latest tag target, latest GitHub Release, commits since release, and explicit tag/release authorization.
- **Git/PR work:** active ruleset, required checks, bypass list, mergeability, conversations, auto-merge state, exact PR HEAD, and main drift.
- **Cloudflare work:** current official docs, active production version/source, branch-build command, Preview URL/source, Worker bindings, and production traffic.
- **Vue/frontend work:** all current Vite entries, HTML shell ownership, shared classic-script consumers, build verifier, metadata, CSP, URLs, i18n, theme, animation, accessibility, and responsive parity.
- **Tracks:** all track IDs, data fields, static slide count, download targets, file sizes, build inclusion, and production/Preview responses. Never infer W9.
- **Song Workspace:** schema/version, IndexedDB/store/index, preferences key/bounds, import/export behavior, shared chord-shape consumers, and every `NO_LYRICS_EGRESS` surface.
- **Key Finder:** current frontend origin resolution, Cloudflare security state, Render health/domain state, route contracts, and official platform behavior. Avoid live analysis jobs.
- **Umami page analytics:** script origin/configuration, production request, CSP, and content-free behavior.
- **Daily Umami:** workflow enabled state, repository-secret names only, repository variables, App installation/least privilege, branch namespaces, open/closed machine PRs, required checks, and latest safe run outcome.
- **Weekly Umami:** official current API docs, credential availability by name only, actual non-skipped output, endpoint/auth/schema compatibility, and issue/artifact behavior.
- **Development Log:** target repository identity, current main, current public evidence, and confirmation that Jam Tracks Hub remains read-only.

## Handoff Maintenance

Update this file when a completed, verified change alters a long-lived architecture contract, user workflow, safety boundary, active follow-up, or canonical checkpoint. Do not append raw conversation transcripts or a full changelog. Never update the handoff solely from an unmerged branch claim or an unverified provider assumption.

When updating mutable fields, preserve the date and make clear what was actually verified. When an architecture contract changes, explain the new contract, rationale, validation, and rollback/stop boundary. Keep this file free of secret values, private capability URLs, private user data, real lyrics, browser-session data, and temporary local paths.
