# Contributing to OutcomeGuard

OutcomeGuard welcomes focused improvements to deterministic hedging, DreamDEX integration, policy enforcement, receipt verification, accessibility, evidence, and judge-facing reliability.

## Development setup

Requirements: Node.js 22 or newer and npm with lockfile support.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

On macOS or Linux, use `cp .env.example .env`. Defaults are fixture-first, dry-run, and Shannon-only. Never add a private key for ordinary development.

Run the complete local release gate:

```bash
npm run verify
```

Run focused checks while iterating:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run secrets:scan
npm run audit:deps
```

## Engineering rules

- Keep TypeScript strict and preserve exact integer/decimal-string arithmetic at financial boundaries.
- Never enable writes to chain ID `5031` or add a mainnet fallback.
- Treat missing balances, RPC reads, or indexer responses as unknown, not zero.
- Key Event Contract state by market ID. Pool addresses can be recycled between windows.
- Read collateral decimals, tick, lot, minimum quantity, venue, expiry, and on-chain status dynamically.
- Preview and pre-sign checks must invoke the same policy implementation.
- No failed mandatory policy may reach a signer.
- A submitted hash is not a confirmed transaction. Require a successful receipt and reconcile the position from chain state.
- Preserve receipt history through linked digests; never mutate an earlier lifecycle artifact invisibly.
- AI output is optional, schema-constrained explanation or intent normalization. It cannot perform arithmetic, construct a transaction, grant authority, or waive policy.
- Keep fixtures deterministic and unmistakably labeled. Never invent a transaction, explorer URL, market result, user, or metric.

## Tests required by change type

| Change | Minimum evidence |
| --- | --- |
| Hedge arithmetic | Unit and fast-check boundary/property tests; budget, depth, rounding, and scenario invariants |
| Policy | PASS/FAIL/WARN boundary tests and proof the signer path is unreachable on failure |
| DreamDEX reads | Fixture test plus live-read evidence when endpoints are available; on-chain/indexer disagreement case |
| DreamDEX write | Shannon-only test with explicit authorization, successful receipt, fill, and reconciled position; never mainnet |
| Receipt schema/canonicalization | Golden digest, key-order invariance, and one-field tamper tests |
| Web flow | Desktop and 390 px Playwright coverage, keyboard path, visible replay/fixture labels |
| Deployment | Clean `npm ci`, build, health check, secret scan, dependency audit, and exact commit evidence |

## Evidence discipline

Every numerical or chain claim must link to a reproducible artifact under `docs/evidence`. Evidence must include capture time, exact commit, SDK version, chain ID, venue ID, market ID, collateral address/decimals, endpoints, and transaction links where applicable.

Do not hand-edit a captured artifact to make a test pass. Regenerate it or append a clearly identified correction. `NOT_PERFORMED`, unavailable, partial fill, reverted transaction, and losing position are legitimate results and must be reported honestly.

## Pull requests

### Repository update cadence

During active OutcomeGuard development, each completed update batch must be committed and pushed to the configured private remote after its relevant checks and working-tree secret scan pass. Every progress report must include the commit hash, branch, push result, and checks run. Public release remains a separate explicit decision and still requires a full Git-history secret scan.

Keep changes small and describe:

- the user or judging outcome improved;
- trust boundaries changed;
- tests and commands run;
- live external actions, if any;
- evidence added or deliberately not added;
- known limitations and rollback plan.

Never commit `.env`, keys, wallet exports, access tokens, or recordings containing sensitive wallet details. Run the working-tree secret scan before every push and a full-history scan before a public release.

Security issues follow [SECURITY.md](SECURITY.md), not public issue discussion.
