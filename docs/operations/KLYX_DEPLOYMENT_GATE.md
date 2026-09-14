# KLYX Deployment Gate

## Contract

Production deployment is a privileged release action, not a consequence of Git activity.

The invariant is:

`exact main SHA -> green checks -> exact build -> manual production deploy -> production verification`

The following rules are mandatory:

- Development chats never deploy KLYX.
- A pull request stops after merge. Merge is not deployment authorization.
- Git pushes and pull requests must not create Vercel production or preview deployments.
- Vercel Deploy Hooks must not be created or invoked for KLYX production.
- Production may be deployed only from the current, true `main` commit.
- The exact `main` SHA must be attached to the Vercel deployment as `klyxMainSha` metadata.
- `/api/health` and the canonical production origin must be verified after deployment.
- The last known healthy Vercel deployment must remain available as a rollback target.
- Only the central KLYX chat is authorized to initiate a production deployment.

`vercel.json` enforces the Git-side boundary with `git.deploymentEnabled = false`. The existing KLYX cron remains unchanged.

## Scope

This gate changes deployment operations only. It must not change Stripe, Supabase business logic, bookings, Brain, application authorization, or production data.

## Evidence captured before disabling Git deployments

On 2026-09-13, before adding `git.deploymentEnabled = false`:

- the true `main` SHA was `91539c4d22d50ba5ef9d08f57d65fda1b0d4d24e`;
- exact-main GitHub runs for KLYX Security Certification, KLYX Golden Path, and KLYX E2E were successful;
- Vercel project `klyx` had a non-Git production deployment `dpl_4ZMUE1HV1bjHvcLwCuZHoW34cARP` in `READY` state;
- that deployment's build log showed `vercel build`, `npm run build`, successful compilation and TypeScript completion;
- `https://www.klyx.be/api/health` returned HTTP 200 with the expected KLYX liveness payload;
- `https://www.klyx.be/` returned HTTP 200.

This demonstrates that the manual Vercel build/deploy transport and post-deploy verification path work without relying on a Git-triggered deployment.

The historical controlled manual deployment above did **not** contain Git SHA metadata and is therefore not the template for future releases. From this gate onward, a release is compliant only when `klyxMainSha=<exact main SHA>` is attached to the deployment and verified. No extra production deployment was created merely to retrofit metadata onto that historical test.

## Manual production release procedure

### 1. Resolve the exact source

Re-fetch GitHub `refs/heads/main` immediately before release and record the full 40-character SHA as `MAIN_SHA`.

The release working tree must satisfy all of the following:

- current branch is `main`;
- local `HEAD == origin/main == MAIN_SHA`;
- working tree and index are clean;
- no later `main` SHA has appeared.

If any equality fails, stop. Never deploy an older checkout because its checks happened to be green.

### 2. Require green checks for that exact `main` SHA

At minimum, require successful exact-SHA runs for the main-push certifications that apply to every release:

- `KLYX Security Certification`;
- `KLYX Golden Path`;
- `KLYX E2E` / `Playwright browser verification`.

Any additional required repository check applicable to the SHA must also be green. A pending, cancelled, skipped when required, or failed gate means no deployment.

`KLYX Performance Certification` is PR/path-triggered rather than a universal `main` push check. When it is required by the change set, its successful PR-head evidence is also required before merge; it must not be invented as an exact-main run when the workflow does not trigger on `main`.

### 3. Build the exact source against production Vercel settings

Use the fail-closed script from the exact `main` checkout:

```powershell
$env:KLYX_PRODUCTION_DEPLOY_AUTHORITY = "central-klyx-chat"
.\scripts\operations\deploy-production-manual.ps1 -ExpectedMainSha $MAIN_SHA
```

Without `-ExecuteDeploy`, the script performs the source/check gate and the exact Vercel production build, but does not deploy.

Review the build result before authorizing production.

### 4. Deploy manually

Only the central KLYX chat may execute:

```powershell
.\scripts\operations\deploy-production-manual.ps1 -ExpectedMainSha $MAIN_SHA -ExecuteDeploy
```

The script uses an explicit prebuilt production deployment and attaches:

- `klyxMainSha=$MAIN_SHA`;
- `klyxReleaseSource=central-klyx-chat`.

It does not use a Git-triggered deployment or Deploy Hook.

After Vercel returns the deployment, inspect it and independently confirm that the deployment metadata contains the same `klyxMainSha` that was resolved from the true `main` immediately before the build. If metadata is absent or differs, the release is invalid even if the site responds.

### 5. Verify production

The script runs the existing operational smoke contract against the canonical production origin:

```powershell
$env:KLYX_PRODUCTION_URL = "https://www.klyx.be"
npm run ops:smoke
```

A valid release requires:

- `https://www.klyx.be/api/health` -> HTTP 200 and `{ status: "ok", service: "klyx", check: "liveness" }`;
- `https://www.klyx.be/` -> HTTP 200 HTML;
- no deployment/runtime error that invalidates the release.

`https://klyx.be` may redirect to the canonical `www` origin. The smoke test intentionally targets the canonical origin directly.

### 6. Record the release

For every production deployment, retain together:

- UTC timestamp;
- exact `main` SHA;
- Vercel deployment ID and immutable deployment URL;
- confirmation that `klyxMainSha` metadata matches;
- health/domain verification result;
- previous healthy deployment ID used as the rollback candidate.

Do not create a Git commit merely to record a deployment: that would move `main` after the deployed SHA. Use the central KLYX release record / deployment ledger instead.

## Rollback

If post-deploy verification fails, stop further release activity and roll production back to the last known healthy deployment:

```powershell
npx vercel rollback <LAST_HEALTHY_DEPLOYMENT_ID_OR_URL>
```

Then re-run:

```powershell
$env:KLYX_PRODUCTION_URL = "https://www.klyx.be"
npm run ops:smoke
```

A rollback restores traffic; it does not change Git history. Diagnose and fix through a normal PR, re-run checks, merge, and use this gate again.

## Prohibited shortcuts

Do not:

- re-enable branch/PR deployments to obtain a preview;
- use a Vercel Deploy Hook as a replacement for the central release action;
- deploy a PR branch, detached unverified SHA, local-only commit, or stale `main`;
- accept successful build output as proof of production health;
- accept a healthy domain as proof that the intended SHA was deployed;
- change Stripe, Supabase business state, bookings, or Brain as part of a deployment-only mission.
