# Umami Analytics GitHub Actions

The daily README snapshot and weekly API report are independent. The daily
snapshot uses an Umami Share dashboard, not the paid API. The weekly report
credentials were absent at the September 2026 audit; a successful credential-skip
is not evidence that weekly reporting works. Weekly implementation is unchanged.

## Weekly API report (separate, optional)

This workflow creates a weekly GitHub issue with a simple Jam Tracks Hub performance report from Umami.

Important: the website tracking script does not require a paid Umami API key. The API key is only required if you want GitHub Actions to automatically fetch Umami data and create report issues.

It reports:

- Pageviews
- Visitors
- Visits
- Bounce rate
- Top pages
- Top referrers
- Top countries / regions
- Tool-page usage priority for Tracks, Progression Writer, Key Finder, and other site tools

## Workflow

```text
.github/workflows/umami-analytics.yml
```

The workflow runs:

- Every Monday at 06:00 Asia/Taipei time
- Manually from GitHub Actions using `Run workflow`

If API credentials are not configured, the scheduled workflow exits cleanly with a notice instead of failing.

## Required Secrets

Set these in GitHub:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Always required:

```text
UMAMI_WEBSITE_ID
```

For the live site, the tracking script is already installed in the page `<head>` tags:

```html
<script defer src="https://cloud.umami.is/script.js" data-website-id="c8dfc471-6512-4344-8e1b-25566e1a93cd"></script>
```

This is enough for normal dashboard analytics on Umami Cloud.

## Umami Cloud Setup

For automated GitHub issue reports on Umami Cloud, add:

```text
UMAMI_API_KEY
```

Umami Cloud API keys require a Pro plan. If the account is on the free plan, the website still tracks visits in the Umami dashboard, but this automated GitHub report will skip itself until API credentials are added.

Optional override:

```text
UMAMI_API_ENDPOINT
```

If omitted, the script uses:

```text
https://api.umami.is/v1
```

## Self-Hosted Umami Setup

For self-hosted Umami, add:

```text
UMAMI_BASE_URL
UMAMI_USERNAME
UMAMI_PASSWORD
```

Example:

```text
UMAMI_BASE_URL=https://analytics.example.com
```

The script will call:

```text
https://analytics.example.com/api/auth/login
```

## Manual Test

From GitHub:

```text
Actions -> Umami Analytics Report -> Run workflow
```

You can choose the number of days to include. The default is 7.

## Local Mock Test

To generate a sample report without Umami credentials:

```bash
UMAMI_MOCK=1 node tools/scripts/umami-analytics-report.js
```

This creates:

```text
analytics-report.md
analytics-report-title.txt
```

These files are generated output and should not be committed.

## Daily README snapshot: protected PR and native auto-merge

Workflow: `.github/workflows/umami-readme-screenshot.yml`.
Schedule: `15 22 * * *` UTC (06:15 Asia/Taipei; GitHub can delay scheduled runs).
History dates and README timestamps use Asia/Taipei.

The old direct-main push failed with GH013 after main protection was enabled.
Protection remains intact; the writer now uses this lifecycle:

```text
schedule -> validated chart -> machine branch -> App-authored PR
         -> static-checks + Workers Builds: jamtrackshub
         -> GitHub native auto-SQUASH -> main -> normal Cloudflare deployment
         -> delete only the confirmed merged machine branch
```

### Narrow autonomous-merge exception

Normal feature, fix, refactor, release, migration and maintenance PRs still require
explicit user merge approval. The one-time implementation PR must have auto-merge
OFF. Only validated daily snapshot PRs from `jam-tracks-hub-umami-snapshot-bot[bot]`
may enroll in native SQUASH auto-merge without daily user intervention.

The writer validates the exact repository, main base, machine branch namespace,
App PR author, signed App-only commits, generating workflow/run provenance,
mergeability, file paths, file modes and README subrange.
GitHub may record `web-flow` as the signing committer;
the author must still be the exact App and signature verification must succeed.
GitHub's optional final commit-message newline is not part of provenance.
Enrollment is bound to the validated head SHA. Required checks are matched by name, head SHA and producer
(GitHub Actions / Cloudflare). GitHub enforces main rules while checks run; the
writer rejects failed, cancelled, timed-out, skipped or neutral check results.
It never invokes direct merge, administrator merge or a bypass fallback.

Main's PR requirement, conversation resolution, linear history, squash policy,
two required checks, force-push/deletion restrictions and empty bypass list stay
unchanged. Repository **Allow auto-merge** must be ON; it does not automatically
enroll normal PRs. **Allow GitHub Actions to create and approve pull requests**
stays OFF. The App, not `GITHUB_TOKEN`, performs PR writes so normal required
workflows can start without intermediate user workflow approval.

### Setup and credential boundaries

Create the private GitHub App `jam-tracks-hub-umami-snapshot-bot`, owned by the
repository owner, and install it on **Jasper-hsury/Jam_Tracks_Hub only**:

- Metadata: read (implicit).
- Contents: read/write.
- Pull requests: read/write.
- No other permission, event webhook, ruleset bypass or unrelated installation.

In repository Settings → Secrets and variables → Actions, provision secrets
`UMAMI_SNAPSHOT_APP_ID` and `UMAMI_SNAPSHOT_APP_PRIVATE_KEY`. Never print their
values. Any temporary private-key file must be outside the repository and deleted
after provisioning. The pinned token action creates a repository-only, short-lived
installation token and revokes it at job completion. `GITHUB_TOKEN` has read-only
contents, PR, checks and Actions permissions for verification.

Keep `UMAMI_SHARE_URL` only as a repository secret. A repository variable or any
other plaintext fallback is prohibited. Obtain the capability from the website's
Share settings in Umami and enter it directly in GitHub's repository-secret UI.
Never put its full value in code, README, commit, PR, log, filename or image
metadata. The workflow fails before dashboard, branch or PR activity when the
secret is unavailable. GitHub's native secret masking protects step environment
rendering, and the first secret-aware step also registers an explicit job-wide
mask before the screenshot automation can run. Errors print bounded state/error
codes, not dashboard text, URLs, path components or API response bodies.

### September 2026 Share capability incident

An Umami dashboard Share capability was exposed in GitHub Actions logs because
the daily workflow allowed a repository-variable fallback. The fallback value
was injected into the runner environment and was not eligible for GitHub's
native secret masking. The affected capability was invalidated, a replacement
was stored only as the `UMAMI_SHARE_URL` repository secret, and the repository
variable was removed.

All 48 confirmed affected GitHub-hosted log sets were deleted while their 48 run
records, timestamps, commit provenance, PRs and deployments were preserved. This
means the known GitHub log surfaces were removed; it does not assert that no one
observed the historical value or that every external copy on the internet was
erased. The daily workflow remains manually disabled until this remediation is
merged and qualified. The GitHub App credentials, permissions, repository-only
installation and empty ruleset bypass list were not changed.

The logging contract is fail-closed: use the repository secret only, inject it
only into the mask-registration and screenshot-publication steps, register the
canonical `add-mask` command before capture, never dump the environment, and
reduce unknown errors to content-free state codes. The full URL, private path,
derived identifier and token are forbidden from stdout, stderr, job outputs,
artifacts, README content, PNG metadata, branch names, commit messages and PR
content. Synthetic `.invalid` capabilities cover those channels in tests; tests
never use the real Share capability.

### Post-merge qualification and re-enable

Do not run the replacement capability from an unmerged security-fix branch. After
the user approves and merges the remediation through the protected main branch:

1. Wait for main `static-checks` and the normal `Workers Builds: jamtrackshub`
   deployment to pass; do not bypass protection or deploy manually.
2. Reconfirm that `UMAMI_SHARE_URL` exists under repository **Secrets**, that no
   same-named repository **Variable** exists, and that the daily workflow source
   on main contains no variable fallback.
3. Re-enable only **Umami README Screenshot** in GitHub Actions.
4. Run one controlled main `workflow_dispatch` with `dry_run=true`. Inspect the
   resulting log rendering only for the expected masked credential and bounded
   status codes; never copy the secret out of GitHub.
5. Confirm that the dry-run path creates no merge and does not change production.
   If content differs, its App-authored test PR must pass both required checks,
   close unmerged and delete only its verified dry-run branch.
6. Leave the workflow enabled for its normal schedule only after the controlled
   run passes. On any raw or derived capability exposure, disable it immediately,
   invalidate that capability and restart incident response.

The autonomous production lifecycle remains App PR → required CI → native
auto-squash → main → normal Cloudflare production deployment. The weekly Umami
API report is a separate follow-up and is not changed by this remediation.

### Snapshot content and last-known-good safety

Only these generated outputs are permitted:

- `README.md`: strictly inside `UMAMI_ANALYTICS_START` / `UMAMI_ANALYTICS_END`,
  with canonical static markup and a formatted timestamp. Outside bytes must match.
- `assets/analytics/umami-dashboard.png`.
- `assets/analytics/history/YYYY-MM-DD.png` with a real calendar date.

PNG validation checks signature, chunk CRC, bounded decompression, scanline filters,
8-bit RGB/RGBA decoding, 600–2000 px width, 250–1000 px height and a 2 MiB maximum.
These bounds derive from the existing 1278 × 521 / 13,254-byte chart plus margin.
Text/EXIF/arbitrary metadata, trailing data, symlinks, renames and deletions are
rejected. It captures only the traffic chart, not a full dashboard/session replay.
No Song Workspace data or new analytics events are introduced.

`UPDATED`, `UNCHANGED`, `INVALID_DASHBOARD`, `FETCH_FAILURE`, `SCREENSHOT_FAILURE`
and `VALIDATION_FAILURE` are distinct. Failed validation exits nonzero before any
snapshot write: latest image, history and timestamp remain last-known-good.
Unchanged decoded pixels create no timestamp-only commit, branch, PR or merge.
Validated files are published together in a Git tree/commit; the writer never
stages the workflow checkout or local artifacts.

### PR lifecycle and safe stops

Production branches use `automation/umami-readme-snapshot-production-YYYY-MM-DD`;
dry-run branches use `automation/umami-readme-snapshot-dry-run-YYYY-MM-DD`.
Branch namespace and PR mode must agree. PR selection, closed-cycle suppression
and cleanup are isolated by mode: dry-run state never blocks or becomes a
production cycle, and production state is never reused by dry-run. Historical
closed date-only branches are classified by their explicit PR mode; they are
never reused or cleaned by the new writer. Historical production rejections
still retain the same identical-content and same-date suppression policy.
One fixed concurrency group, with cancellation disabled, serializes writers.
At most one production snapshot PR and one separate dry-run PR may be open;
the next valid changed snapshot updates its same-mode branch with a normal
fast-forward commit and new CI. It never force-pushes or resets a branch.

Fresh main is checked before writes. Conflicts, unexpected authors/files, unknown
mergeability, changed head, failed checks or ambiguous inventories safely stop.
Existing auto-merge is disabled before updating an open PR; a failed generation or
unchanged retry does not merge that PR. A valid changed retry re-enrolls it. A
human-closed, unmerged snapshot is not recreated with identical pixels; a later
materially new daily snapshot may start a new dated cycle. A closed same-day cycle
is not reopened. The validator bounds an open cycle to 30 commits / 34 changed
files; excessive stale cycles require investigation, not relaxed validation.

CI failure leaves the PR open and main unchanged. The writer waits up to roughly
40 minutes for native merge (job timeout 55 minutes). Timeout is a failure, not
proof of merge; native enrollment may remain pending under GitHub rules. A later
run checks old merged PRs for safe branch cleanup. Only a machine branch whose
tip still matches its confirmed merged PR can be deleted. Missing already-cleaned
branches are harmless; human branches and main are never cleanup targets.

### Validation and non-merging dry run

Use locked `npm ci`, Node 22.23.2 and Playwright 1.63.0; browser installation uses
`npx --no-install playwright install --with-deps chromium`. Dependencies and action
revisions are pinned. Tests never contact live Umami:

```bash
node --test tests/umami-snapshot*.test.js
npm test
npm run check
npm run build:cloudflare
npm run verify:cloudflare
git diff --check
```

Manual workflow dispatch defaults `dry_run` to true. Before implementation merge,
only `fix/umami-readme-automerge-v1` may run the workflow off main, and only in dry
mode. The dry PR starts from main, not the implementation branch. It uses the real
App/chart, validates the exact diff and waits for both required checks to succeed,
then closes without merging and deletes only its test branch. It never enables
auto-merge. A no-diff result is not proof of PR/check startup. Production/main must
stay unchanged throughout this dry test. After user-authorized implementation
merge, scheduled main runs use production mode; explicit main dispatch with
`dry_run=false` has the same narrowly authorized production behavior.
An unchanged dry-run retry may finish check verification and close its existing
test PR; it creates no new commit/branch/PR and never enrolls in auto-merge.

### Rollback

Disable only the daily README workflow in Actions, then disable native auto-merge
on any still-open machine PR (disabling a workflow alone does not cancel GitHub's
pending enrollment). If retiring the integration, revoke its repository-only App
installation and remove its two secrets. Preserve existing screenshots/history and
main protection. Any code rollback follows a normal user-approved PR; do not
restore direct-main pushes. No product version, tag or release is changed by this
automation reliability fix.
