# Local release-gate report

Date: 2026-08-28 09:54 UTC  
Environment: Windows, Node `v24.14.1`, npm `11.11.0`  
Command: `npm run verify`

## Result

`PASS`

| Gate | Result | Evidence |
| --- | --- | --- |
| ESLint | pass | `eslint .` exited 0 |
| TypeScript strict workspaces | pass | agent, web, dreamdex, hedge-engine, policy-engine, receipt, schemas, shared |
| Unit/property/integration tests | pass | 4 files, 16 tests |
| Production build | pass | Next.js 16.3.3 plus all buildable workspaces |
| Desktop judge flow | pass | Playwright Chromium, 1440 px |
| Mobile judge flow | pass | Playwright Chromium, 390 px |
| Health endpoint checks | pass | both Playwright projects |
| Working-tree secret scan | pass | 92 files at run time |
| Dependency audit | pass | `found 0 vulnerabilities` |
| Clean install | pass | final lockfile installed with `npm ci` |
| Agent container | pass | Docker image built; fixture container returned healthy on `/health` |

Additional checks:

- Live Shannon evidence capture succeeded for market `0x…bcbe` at block `473363505`.
- Receipt tamper, unsupported-claim, and linked-chain regression tests passed.
- Preview and pre-sign policy entry points are the same function and have an equality test.
- DreamDEX writes are blocked without a policy-and-signature execution guard; the adapter also requires a one-time receipt digest and matching order fingerprint.
- Fixture worker started without a key in `DRY_RUN=true`, returned healthy on `/health`, produced structured logs, and observed one deterministic market.

## Honest exclusions

The release gate does not prove a wallet-authorized IOC, fill, resulting position, settlement, redemption, public deployment, video, or full-history scan. Those remain external-action blockers and are not claimed.
