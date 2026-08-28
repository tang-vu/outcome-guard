# Local release-gate report

Date: 2026-08-28 17:21 UTC
Environment: Windows, Node `v24.14.1`, npm `11.11.0`  
Command: `npm run verify`

## Result

`PASS`

| Gate | Result | Evidence |
| --- | --- | --- |
| ESLint | pass | `eslint .` exited 0 |
| TypeScript strict workspaces | pass | agent, web, dreamdex, hedge-engine, policy-engine, receipt, schemas, shared |
| Unit/property/security-boundary tests | pass | 5 files, 25 tests |
| Production build | pass | Next.js 16.3.3 plus all buildable workspaces; metadata, manifest, robots, icon, and Open Graph routes generated |
| Desktop judge flow | pass | 3 Playwright Chromium checks, 1440 px |
| Mobile judge flow | pass | 3 Playwright Chromium checks, 390 px; overflow and reduced-motion assertions included |
| Health endpoint checks | pass | both Playwright projects against the production server |
| Working-tree secret scan | pass | 100 files at run time |
| Dependency audit | pass | `found 0 vulnerabilities` |
| Clean install | pass | final lockfile installed with `npm ci` |
| Agent container | pass | Docker image built; fixture container returned healthy on `/health` |

Additional checks:

- Live Shannon evidence capture succeeded for market `0x…bcbe` at block `473363505`.
- Receipt tamper, unsupported-claim, and linked-chain regression tests passed.
- Preview and pre-sign policy entry points are the same function and have an equality test.
- DreamDEX writes are blocked without a policy-and-signature execution guard. Its current one-time set and signer queue are process-local, not restart-safe; durable coordination remains an explicit write-mode gate.
- The authorization API independently verifies canonical receipt integrity before producing a linked authorization receipt and execution bundle.
- Receipt tampering and execution-bundle signer substitution are rejected by regression tests.
- Exact execution mandates bind raw IOC price, quantity, premium, expiry, market snapshot, worker signer and receipt. Tests recover a real EIP-191 test signature and reject raw-field tampering, wrong worker identity and deadline boundaries.
- DreamDEX order construction checks both outcome and transmitted YES tick grids. Live snapshots directly read ERC-20 metadata and fail if collateral decimals disagree; pool-scoped events distinguish `OrderPlaced` from actual `OrderRested` evidence.
- Durable journal tests cover restart hash-chain verification, exclusive signer locking, changed/torn record refusal, absolute-path enforcement, and 25 concurrent appends with unique ordered sequence numbers. Adapter wiring and crash-safe SDK submission recovery remain excluded.
- Fixture worker started without a key in `DRY_RUN=true`, returned healthy on `/health`, produced structured logs, and observed one deterministic market.

## Honest exclusions

The release gate does not prove a wallet-authorized IOC, fill, resulting position, settlement, redemption, public deployment, video, or full-history scan. Those remain external-action blockers and are not claimed.
