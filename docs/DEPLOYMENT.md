# Deployment Guide

OutcomeGuard deploys as a Next.js web application plus an optional long-running observer/agent container. Both target Somnia Shannon chain ID `50312`; there is no mainnet write configuration.

## Release prerequisites

From the exact commit to deploy:

```bash
npm ci
npm run verify
npm run secrets:scan
gitleaks git --redact --log-opts="--all"
```

Record command output, Node/npm versions, commit SHA, lockfile digest, and any justified audit exception in `docs/evidence/test-report.md`. Regenerate live-read evidence from that commit. Do not proceed when execution/settlement evidence is still represented as complete anywhere other than an explicit blocker.

## Local deterministic demo

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Open `http://localhost:3000`. The default environment is `DRY_RUN=true` and `FIXTURE_MODE=true`. The judge screen labels its deterministic fallback; `/api/markets` separately attempts live Shannon discovery.

Check:

```text
GET http://localhost:3000/api/health
GET http://localhost:3000/api/markets
```

An unavailable live endpoint should produce an honest 503 response from `/api/markets` while the labeled fixture preview remains usable.

## Web deployment on Vercel

Use the repository root as the project root so npm workspaces under `packages/` remain available.

Recommended project settings:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Install | `npm ci` |
| Build | `npm run build -w @outcome-guard/web` |
| Node | 22 or the exact verified compatible runtime |
| Output | Next.js default |

Public, non-secret environment values:

```text
NEXT_PUBLIC_CHAIN_ID=50312
NEXT_PUBLIC_RPC_URL=https://api.infra.testnet.somnia.network
NEXT_PUBLIC_FIXTURE_MODE=true
VENUE_ID=0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c
RPC_URL=https://api.infra.testnet.somnia.network
WS_RPC_URL=wss://api.infra.testnet.somnia.network/ws
INDEXER_URL=https://dev.smk.somnia.host/v1/graphql
```

Do not configure `PRIVATE_KEY` in the web project. Preview deployment should keep fixture fallback enabled even when live reads are healthy.

After deployment, verify:

```bash
curl --fail https://YOUR_HOST/api/health
curl --fail https://YOUR_HOST/api/markets
```

Then exercise the desktop and 390 px judge flow, wallet/network error state, receipt route, unavailable-live fallback, and security headers. Save the exact deployment URL and commit association only after these checks pass.

## Agent container

The root `Dockerfile` packages the Node agent. Verify the image locally before choosing a container host:

```bash
docker build --pull -t outcomeguard-agent:local .
docker run --rm -p 8787:8787 \
  -e NETWORK=testnet \
  -e CHAIN_ID=50312 \
  -e DRY_RUN=true \
  -e FIXTURE_MODE=true \
  outcomeguard-agent:local
curl --fail http://localhost:8787/health
```

For live observation, set `FIXTURE_MODE=false` but retain `DRY_RUN=true`. The current agent observes markets; it does not initiate IOC or redemption jobs.

The image runs as a non-root user, declares `/var/lib/outcomeguard` as its persistent state volume, and includes a container healthcheck. Never put a key in an image layer, deployment file, build argument, public variable, log, or health endpoint.

The observer command never executes. The separate one-shot path is intentionally local-file-only:

```bash
npm run execute-once -w @outcome-guard/agent -- --bundle /secure/inbox/signed-bundle.json
```

It requires `DRY_RUN=false`, `FIXTURE_MODE=false`, the encrypted-runtime `PRIVATE_KEY`, absolute persistent `EXECUTION_STATE_DIR`, and `INITIAL_TOTAL_PREMIUM_AT_RISK` reconciled from the dedicated wallet. It verifies that the bundle's public execution signer matches the loaded key, reruns policy from fresh Shannon reads, claims the authorization once, records the submission boundary, and seals a linked execution receipt only after fill/position reconciliation. After an ambiguous SDK call it retains the signer lock and exits; do not delete that lock or retry until the signer nonce and chain are reconciled.

Run one replica for any signer. Horizontal replicas are safe only for read-only observation; signing is deliberately single-replica and filesystem-locked.

## Startup and health expectations

The agent validates `NETWORK=testnet` and `CHAIN_ID=50312`, defaults to dry-run fixture mode, logs structured JSON startup state, and exposes `/health` on `PORT` (default `8787`). A healthy response must report Shannon, configured venue, mode, dry-run status, last cycle, and markets seen without revealing secrets.

The web exposes `/api/health`. Health proves process readiness, not DreamDEX correctness, successful execution, or settlement.

## Rollback

Web rollback is a deployment-provider alias change to the last verified immutable build. Worker rollback is stop-first: disable write mode, gracefully terminate, reconcile every pending nonce/hash, then start the prior image in dry-run until state is understood. Never start two signing versions concurrently.

## Public release gate

Before making the repository public or publishing links:

1. Run working-tree and full-history secret scans.
2. Confirm `.env`, wallet exports, recordings, debug logs, and generated live artifacts are excluded.
3. Regenerate verification/evidence from the exact release commit.
4. Confirm every transaction claim has a real Shannon explorer link and successful receipt.
5. Confirm replay/fixture content is labeled in UI, video, README, and receipt.
6. Verify the deployment, mobile layout, receipt tamper test, dependency audit, and clean `npm ci`.
7. Review [LIMITATIONS.md](../LIMITATIONS.md), [NOTICE.md](../NOTICE.md), and [BLOCKERS.md](../BLOCKERS.md).
8. Obtain the repository owner's explicit approval for public visibility and final hosting/submission URLs.
