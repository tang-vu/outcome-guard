# Local release-gate report

Date: 2026-08-31 04:32 UTC
Environment: Windows, Node `v24.14.1`, npm `11.11.0`  
Command: `npm run verify`

## Result

`PASS`

| Gate | Result | Evidence |
| --- | --- | --- |
| ESLint | pass | `eslint .` exited 0 |
| TypeScript strict workspaces | pass | agent, web, dreamdex, execution-coordinator, hedge-engine, policy-engine, receipt, schemas, shared |
| Unit/property/security-boundary tests | pass | 7 files, 36 tests, including provider validation, prompt-injection-as-data behavior, atomic execution queue, replay refusal, and mandate-stable job identity |
| Production build | pass | Next.js 16.3.3 plus all buildable workspaces; metadata, manifest, robots, icon, and Open Graph routes generated |
| Desktop judge flow | pass | 12 Playwright Chromium checks, 1440 px, including execution, settlement and redemption artifact explorers |
| Mobile judge flow | pass | 12 Playwright Chromium checks, 390 px; redemption truth, settlement evidence, hydration-safe parser binding, market-horizon binding, overflow and reduced-motion assertions included |
| Health endpoint checks | pass | both Playwright projects against the production server |
| Portable tree/history secret scan | pass | 119 files plus 31 commits/refs at run time; provider, PEM, bearer, mnemonic and private-key patterns |
| Independent secret scan | pass | Gitleaks 8.30.1 scanned the 115-file release-tree snapshot with no leaks and scanned 22 commits / ~897 KB with no leaks |
| Dependency audit | pass | `found 0 vulnerabilities` |
| Public deployment | pass | local and Cloudflare-routed health returned `outcome-guard-web` on Shannon `50312`; homepage returned HTTP 200 with CSP and HSTS |
| Clean install | pass | final lockfile installed with `npm ci` |
| Agent container | pass | Docker image built; non-root `outcomeguard` fixture container reached Docker `healthy`, returned `/health`, and used an isolated state mount |

Additional checks:

- Live Shannon evidence capture succeeded from clean source commit `351b014bfb9fa7ea6082fbdd47d10765a159925b` for market `0x…c248` at block `473676996`; a second deterministic plan derivation matched its canonical input.
- Receipt tamper, unsupported-claim, and linked-chain regression tests passed.
- Preview and pre-sign policy entry points are the same function and have an equality test.
- The allowlisted authorization handoff atomically queues the signed bundle, exposes a sanitized status endpoint, keys claims by mandate digest, refuses replay, and marks ambiguous restarts `RECOVERY_REQUIRED`. A deployed smoke test fed an already-expired historical bundle through the private inbox and observed the expected public `FAILED` status without invoking the signer.
- A dedicated-test-agent live E2E selected an eligible Shannon market without weakening policy, signed and verified the exact mandate, queued it through the production watcher, mined bounded IOC `0xbe1b148423553b21f7c4177248dc6be19406e1416b1f065cc556279de4da03be`, reconciled a `29.182` NO position delta and `14.182452 tUSDC` spend, hash-chained six journal stages, and independently verified execution receipt `0x2cdeed07d710ace2360624c29989bca315260bf25eb03ca803e6ce90db304d79`. This test does not claim human wallet authorization.
- The owned market was later read directly at Shannon block `475953729` as finalized `Resolved`, winning `YES / UP`. The worker still held `29.182 NO`, so claimable was exactly `0`; linked settlement receipt `0x403e08fa79d0e0374f54886b79f00b4e6c52e90a2915b0904625ac244916537d` verifies independently. No pointless or fabricated redemption is claimed.
- A second ETH 15m lifecycle filled `4.171 NO` in `0xabc2f01852be3f1d75ec643524330d47dff2a50bb2ad890b85814e924e8abe99`, resolved `DOWN` at direct-read block `476073320`, and redeemed `4.171 tUSDC` in `0x7021c55eb19271a22404f94c1ea5c639331a147ec2161ee3fbb07d7e4f81effc`. Winning-token balance reconciled to zero; bundle and three lifecycle receipts verify with linked digests.
- DreamDEX writes are blocked without a policy-and-signature execution guard. The guarded `execute-once` path adds a durable bundle claim, signer lock, fresh shared-policy pass and submission journal; it retains the lock after ambiguity instead of retrying.
- The authorization API independently verifies canonical receipt integrity before producing a linked authorization receipt and execution bundle.
- Receipt tampering and execution-bundle signer substitution are rejected by regression tests.
- The packaged receipt explorer revalidates schema and canonical digest server-side, exposes an attachment endpoint, discloses incomplete lifecycle stages, and returns `404` for unknown digests. Desktop and 390 px E2E checks cover the valid and fail-closed paths.
- Exact execution mandates bind raw IOC price, quantity, premium, expiry, market snapshot, worker signer and receipt. Tests recover a real EIP-191 test signature and reject raw-field tampering, wrong worker identity and deadline boundaries.
- DreamDEX order construction checks both outcome and transmitted YES tick grids. Live snapshots directly read ERC-20 metadata and fail if collateral decimals disagree; pool-scoped events distinguish `OrderPlaced` from actual `OrderRested` evidence.
- Durable journal tests cover restart hash-chain verification, exclusive signer locking, changed/torn record refusal, absolute-path enforcement, and 25 concurrent appends with unique ordered sequence numbers. Explicit nonce/raw-transaction recovery and crash-injection evidence remain excluded.
- Fixture worker started without a key in `DRY_RUN=true`, returned healthy on `/health`, produced structured logs, and observed one deterministic market.
- Finalized-market discovery and a direct on-chain read captured ETH one-hour market `…c124` at block `473662365` as `Resolved`, winning `NO / DOWN`. The UI verifies its evidence digest and explicitly claims no owned position or redemption.

## Honest exclusions

The release gate proves dedicated-test-agent IOC fills, resulting positions, both settlement outcomes, and a winning-position redemption with post-state reconciliation. It does not prove a human-wallet execution or video. Public deployment is separately evidenced in `deployment.json` and does not imply production financial readiness.
