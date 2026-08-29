# Local release-gate report

Date: 2026-08-29 17:54 UTC
Environment: Windows, Node `v24.14.1`, npm `11.11.0`  
Command: `npm run verify`

## Result

`PASS`

| Gate | Result | Evidence |
| --- | --- | --- |
| ESLint | pass | `eslint .` exited 0 |
| TypeScript strict workspaces | pass | agent, web, dreamdex, execution-coordinator, hedge-engine, policy-engine, receipt, schemas, shared |
| Unit/property/security-boundary tests | pass | 6 files, 28 tests, including provider validation and prompt-injection-as-data behavior |
| Production build | pass | Next.js 16.3.3 plus all buildable workspaces; metadata, manifest, robots, icon, and Open Graph routes generated |
| Desktop judge flow | pass | 7 Playwright Chromium checks, 1440 px |
| Mobile judge flow | pass | 7 Playwright Chromium checks, 390 px; hydration-safe parser binding, market-horizon binding, overflow and reduced-motion assertions included |
| Health endpoint checks | pass | both Playwright projects against the production server |
| Portable tree/history secret scan | pass | 115 files plus 22 commits/refs at run time; provider, PEM, bearer, mnemonic and private-key patterns |
| Independent secret scan | pass | Gitleaks 8.30.1 scanned the 115-file release-tree snapshot with no leaks and scanned 22 commits / ~897 KB with no leaks |
| Dependency audit | pass | `found 0 vulnerabilities` |
| Public deployment | pass | local and Cloudflare-routed health returned `outcome-guard-web` on Shannon `50312`; homepage returned HTTP 200 with CSP and HSTS |
| Clean install | pass | final lockfile installed with `npm ci` |
| Agent container | pass | Docker image built; non-root `outcomeguard` fixture container reached Docker `healthy`, returned `/health`, and used an isolated state mount |

Additional checks:

- Live Shannon evidence capture succeeded from clean source commit `351b014bfb9fa7ea6082fbdd47d10765a159925b` for market `0x…c248` at block `473676996`; a second deterministic plan derivation matched its canonical input.
- Receipt tamper, unsupported-claim, and linked-chain regression tests passed.
- Preview and pre-sign policy entry points are the same function and have an equality test.
- DreamDEX writes are blocked without a policy-and-signature execution guard. The explicit local-file-only `execute-once` path now adds a durable bundle claim, signer lock, fresh shared-policy pass and submission journal; it retains the lock after ambiguity instead of retrying.
- The authorization API independently verifies canonical receipt integrity before producing a linked authorization receipt and execution bundle.
- Receipt tampering and execution-bundle signer substitution are rejected by regression tests.
- The packaged receipt explorer revalidates schema and canonical digest server-side, exposes an attachment endpoint, discloses incomplete lifecycle stages, and returns `404` for unknown digests. Desktop and 390 px E2E checks cover the valid and fail-closed paths.
- Exact execution mandates bind raw IOC price, quantity, premium, expiry, market snapshot, worker signer and receipt. Tests recover a real EIP-191 test signature and reject raw-field tampering, wrong worker identity and deadline boundaries.
- DreamDEX order construction checks both outcome and transmitted YES tick grids. Live snapshots directly read ERC-20 metadata and fail if collateral decimals disagree; pool-scoped events distinguish `OrderPlaced` from actual `OrderRested` evidence.
- Durable journal tests cover restart hash-chain verification, exclusive signer locking, changed/torn record refusal, absolute-path enforcement, and 25 concurrent appends with unique ordered sequence numbers. Explicit nonce/raw-transaction recovery and crash-injection evidence remain excluded.
- Fixture worker started without a key in `DRY_RUN=true`, returned healthy on `/health`, produced structured logs, and observed one deterministic market.
- Finalized-market discovery and a direct on-chain read captured ETH one-hour market `…c124` at block `473662365` as `Resolved`, winning `NO / DOWN`. The UI verifies its evidence digest and explicitly claims no owned position or redemption.

## Honest exclusions

The release gate does not prove a wallet-authorized IOC, fill, resulting position, settlement, redemption, or video. Those remain external-action blockers and are not claimed. Public deployment is separately evidenced in `deployment.json` and does not imply production financial readiness.
