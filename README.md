# OutcomeGuard

**Turn a downside concern into bounded, verifiable protection.**

OutcomeGuard is a Shannon-testnet prototype that derives short-duration BTC or ETH portfolio protection from a user's existing exposure, checks it against deterministic policy, requires human authorization, and preserves an intent-to-settlement receipt.

> Testnet software only. Not financial advice. A binary Event Contract is nonlinear and may not track a wallet's spot loss because of strike, timing, oracle, liquidity, and settlement basis risk.

## 1. The problem

Prediction interfaces ask whether BTC or ETH will go up or down. Treasury tools begin somewhere else: “I already own this exposure; how much can I afford to lose over the next hour?” Turning that concern into an Event Contract order requires market discovery, book interpretation, exact tick and lot arithmetic, liquidity-aware sizing, policy checks, wallet authorization, receipt confirmation, position reconciliation, settlement, and redemption.

OutcomeGuard makes that chain explicit. It does not ask an AI model to predict price, perform arithmetic, waive policy, construct a transaction, or sign.

## 2. Why Event Contracts

DreamDEX Event Contracts offer short, defined windows and a bounded premium for an outcome share. A DOWN share can offset some portfolio loss when the selected market settles DOWN. The maximum premium is known before signing, IOC execution can bound the order, and settlement is verifiable on Somnia.

The trade-off is basis risk: the contract pays according to its own settlement question, not the wallet's exact mark-to-market loss. OutcomeGuard exposes this mismatch rather than calling the result a perfect hedge.

## 3. Product screenshots

The release candidate is exercised at both desktop and 390 px mobile widths. These screenshots show the deterministic fallback and do not depict a live or simulated transaction.

![OutcomeGuard desktop judge flow](docs/demo/outcomeguard-desktop.png)

<img src="docs/demo/outcomeguard-mobile.png" alt="OutcomeGuard at 390 pixel mobile width" width="390" />

The evidence-first Receipt Explorer verifies the packaged artifact server-side and keeps incomplete lifecycle stages visually explicit:

![OutcomeGuard verified receipt explorer](docs/demo/outcomeguard-receipt-explorer.png)

## 4. The 90-second judge path

1. Enter a natural-language concern or use the structured manual ETH/BTC exposure and horizon controls; deterministic schema-bound parsing updates the controls locally.
2. Set adverse move, maximum premium, slippage, and target protection.
3. Inspect the selected Event Contract, order book, expiry, settlement reference, and freshness.
4. Compare unhedged and protected scenario P&L, including premium-at-risk and basis risk.
5. Read every `PASS`, `WARN`, and `FAIL`. A failure disables execution.
6. Review the exact order and authorize it with an injected Shannon wallet.
7. Follow confirmation, reconciliation, receipt verification, settlement, and redemption.

At the current checkpoint, steps 1–5 and pre-execution receipt generation work in deterministic fixture mode and through an opt-in `Derive live plan` path that refetches the selected Shannon market server-side. Exact authorization and the guarded one-shot worker are implemented; funded-wallet execution and position reconciliation remain pending. A separately labeled historical replay verifies a real terminal market without claiming ownership or redemption.

## 5. Live deployment

The public judge build is live at [`https://outcomeguard.tangvu.dev`](https://outcomeguard.tangvu.dev). A named Cloudflare Tunnel is the only public ingress to the loopback-bound production origin; PM2 supervises both the web process and tunnel and restores its saved process list after Windows reboot and user logon. The captured HTTP, health, security-header, tunnel, and persistence facts are in [`docs/evidence/deployment.json`](docs/evidence/deployment.json).

The web health route is `/api/health`; the worker exposes `/health`. See [`Dockerfile`](Dockerfile) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the intended web/worker split.

## 6. Demo video

**Pending external artifact — no video URL is claimed.** The production-ready narrative is in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md), with capture requirements in [`VIDEO_SHOTLIST.md`](VIDEO_SHOTLIST.md). The final video target is 2–3 minutes and must show a real explorer proof plus a clearly labeled settled lifecycle; it must never present fixture data as live execution.

## 7. Architecture

```text
exposure + limits
  -> strict intent schema
  -> live/fixture DreamDEX snapshot
  -> deterministic hedge engine
  -> shared fail-closed policy engine
  -> exact human authorization
  -> bounded Shannon IOC
  -> confirmed receipt + position reconciliation
  -> settlement + redemption
  -> linked canonical receipt digests
```

The indexer is used for discovery, venue metadata, and history. OutcomeGuard requires an explicit venue ID and records that indexer-derived provenance; the current SDK does not independently prove venue membership on chain. Chain ID, market generation/status, book parameters, balances, mined receipt, and position state are read on chain. Missing data is unknown, never silently zero.

- [`apps/web`](apps/web): judge journey and injected-wallet authorization.
- [`apps/agent`](apps/agent): fixture/live observation loop plus a guarded `execute-once` command that independently verifies, policy-checks, journals, executes and reconciles one signed mandate.
- [`packages/dreamdex`](packages/dreamdex): Shannon-only market, exact-unit IOC, confirmation, position, finalized-market, and redemption adapter.
- [`packages/hedge-engine`](packages/hedge-engine): deterministic sizing and scenario P&L.
- [`packages/policy-engine`](packages/policy-engine): versioned preview/pre-sign evaluator.
- [`packages/shared`](packages/shared): provider-neutral intent-parser contract, deterministic local parser/fallback, Shannon constants, and exact authorization message.
- [`packages/receipt`](packages/receipt): RFC 8785 canonicalization, SHA-256 sealing, linked stages, verifier, and CLI.
- [`packages/execution-coordinator`](packages/execution-coordinator): durable one-time authorization claims keyed by mandate digest, exclusive signer lock, and tamper-evident execution journal.

Detailed design: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/architecture/trust-boundaries.md`](docs/architecture/trust-boundaries.md), and [`docs/architecture/execution-journal.md`](docs/architecture/execution-journal.md).

## 8. Real testnet proof

The repository contains a real **live-read** Shannon snapshot captured on 28 August 2026:

- Network and SDK: [`docs/evidence/environment.json`](docs/evidence/environment.json)
- Live market and book: [`docs/evidence/market-snapshot.json`](docs/evidence/market-snapshot.json)
- Deterministic plan from that book: [`docs/evidence/hedge-plan.json`](docs/evidence/hedge-plan.json)
- Policy result: [`docs/evidence/policy-evaluation.json`](docs/evidence/policy-evaluation.json)
- Pre-execution receipt: [`docs/evidence/pre-execution-receipt.json`](docs/evidence/pre-execution-receipt.json)
- Verified terminal-market replay: [`docs/evidence/verified-settled-replay.json`](docs/evidence/verified-settled-replay.json)

The latest captured market was ETH, one hour, Shannon chain `50312`, market ID ending `c248`, block `473676996`, and onchain status `Trading`. The capture was made from clean source commit `351b014bfb9fa7ea6082fbdd47d10765a159925b`; market and plan checks passed, while existing premium risk, gas balance, and human approval remained unknown or absent, so execution correctly failed closed. See the full values in the linked evidence rather than relying on a summary.

OutcomeGuard also completed a real dedicated-test-agent lifecycle on 31 August 2026: bounded IOC [`0xbe1b…03be`](https://shannon-explorer.somnia.network/tx/0xbe1b148423553b21f7c4177248dc6be19406e1416b1f065cc556279de4da03be) filled `29.182 NO`, spent `14.182452 tUSDC`, and reconciled the position on chain. Market `…ea9a` later finalized `YES / UP` at observed block `475953729`, leaving the held NO position with exactly zero claimable. The linked [execution](docs/evidence/execution-receipt.json) and [settlement](docs/evidence/settlement-receipt.json) receipts prove this honestly; no zero-value redemption is fabricated. The separate `…c124` historical replay remains available only as venue evidence.

## 9. Receipt verification

Receipts are strict versioned JSON. OutcomeGuard canonicalizes their JSON-compatible content with RFC 8785 JCS, computes SHA-256 without the claimed digest field, and verifies the result independently. A later lifecycle receipt points to the earlier digest rather than rewriting history.

```bash
npm run receipt:verify -- docs/evidence/pre-execution-receipt.json
npm run receipt:verify -- docs/evidence/execution-receipt.json
npm run receipt:verify -- docs/evidence/settlement-receipt.json
```

Changing any sealed field must produce a digest mismatch. The verifier and tamper tests are in [`packages/receipt`](packages/receipt). The release packages a verified human/raw explorer at `/receipts/0x2b60a01fddcd5e8cb3e0b21b10d8bcfe8de3f4fee8f6dd388d310837d8731ce2`; unknown digests fail closed, and the API serves a downloadable artifact only after server-side verification.

## 10. Differentiation

OutcomeGuard owns an exposure-first workflow:

- Rivo evaluates whether an agent deserves capital.
- Sluice constrains a trade the user already selected.
- Branch sequences a conditional multi-window thesis.
- rampart classifies firm resting liquidity.
- PredicTrader predicts and enables copy-trading.
- Market Dungeon turns outcomes into a game.
- OutcomeGuard derives bounded protection from portfolio exposure that already exists.

The full evidence-based audit, including weaknesses, is in [`docs/COMPETITIVE_POSITIONING.md`](docs/COMPETITIVE_POSITIONING.md).

## 11. Judging-criteria matrix

| Criterion | OutcomeGuard evidence and intended judge proof | Current status |
| --- | --- | --- |
| Technical implementation — 25% | Official SDK `0.28.1`; chain/indexer reconciliation boundary; exact bigint DreamDEX adapter; deterministic hedge/policy/receipt packages | Live read, bounded fill, position reconciliation, and owned settlement proven |
| Innovation — 20% | Exposure-derived Event Contract protection plus linked intent-to-settlement receipts | Implemented through terminal settlement |
| UX and design — 20% | One exposure-to-authorization journey, visible failure reasons, scenario chart, deterministic fallback | Desktop and 390 px Playwright flows pass; release screenshots included |
| Business and ecosystem impact — 20% | Wallet and treasury protection rather than speculative signals; sponsor SDK feedback | Thesis and SDK report complete; no user/traction claims |
| Presentation — 15% | Under-90-second pre-settlement flow, real explorer proof, tamper check, labeled settled replay | Chain proof ready; script and shot list ready; video pending |

## 12. Quick start

Requirements: Node.js 22 or newer. Fixture mode needs no wallet or paid API.

```bash
npm ci
npm run dev
```

Open `http://localhost:3217`. OutcomeGuard reserves this project-specific development port to avoid silently opening an unrelated service on the common port 3000. The default composer is a clearly labeled deterministic fallback. The live market endpoint is `http://localhost:3217/api/markets` and fails honestly with HTTP 503 if Shannon reads are unavailable.

Public judge deployment: [`https://outcomeguard.tangvu.dev`](https://outcomeguard.tangvu.dev). It is routed through a named Cloudflare Tunnel to a loopback-only production origin supervised by PM2; the deterministic fallback remains available when live Shannon reads fail.

Run the observer worker:

```bash
npm run agent
```

Defaults are `DRY_RUN=true` and `FIXTURE_MODE=true`. Copy [`.env.example`](.env.example) only when changing public endpoints or using a dedicated disposable Shannon signer. Never use a personal key.

## 13. Verification commands

The complete intended local release gate is:

```bash
npm run verify
```

It composes lint, strict type checking, unit/property tests, production build, Playwright E2E, working-tree secret scanning, and dependency audit. Individual commands are in [`package.json`](package.json).

**Checkpoint truth:** the release gate passed locally on 28 August 2026: lint, strict workspace type checks, 28 Vitest tests, production builds, twelve Playwright checks across desktop and 390 px mobile, a 110-file tree plus full-history secret scan, and an npm audit with zero known vulnerabilities. See [`docs/evidence/test-report.md`](docs/evidence/test-report.md).

## 14. Security model

- Writes are hard-blocked outside Shannon chain `50312`.
- The browser uses an injected wallet; the worker accepts only a disposable testnet key.
- AI can normalize or explain but cannot calculate, waive policy, construct a transaction, or sign.
- Preview and pre-sign expose the same evaluator. A live plan can issue an exact raw-unit IOC mandate only when a dedicated worker address is configured; the server verifies the EIP-191 signature and allowlisted human signer, seals a linked bundle, and atomically queues it. The PM2 worker independently verifies it and reruns the same policy engine from fresh Shannon reads. Downloading the bundle is optional evidence, not an execution step.
- A tx hash alone is not confirmation; a successful mined receipt and position evidence are required.
- Venue ambiguity, stale state, unknown balances, zero normalized size, changed book, or irreproducible receipt inputs block execution.
- The local execution path durably claims one-time bundles, locks a signer, hash-chains execution states, journals the submission boundary, and refuses automatic retry after ambiguity. A real funded Shannon run, explicit nonce/raw-transaction recovery and crash-injection evidence remain release gates before claiming production readiness.

See [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md), [`SECURITY.md`](SECURITY.md), and the passing [full-history Gitleaks report](docs/evidence/full-history-secret-scan.md).

## 15. Known limitations

- A real Shannon bounded IOC is recorded in dedicated-test-agent mode: transaction [`0xbe1b…03be`](https://shannon-explorer.somnia.network/tx/0xbe1b148423553b21f7c4177248dc6be19406e1416b1f065cc556279de4da03be) filled `29.182` NO at average `0.486`; the worker reconciled the position delta and sealed receipt `0x2cde…d79`. This is not represented as a human wallet authorization.
- No settled historical replay or OutcomeGuard redemption proof is included yet.
- The composer defaults to a judge-reliable fixture. Its `LIVE READ EVIDENCE` panel can opt into `Derive live plan`, which refetches the selected market ID server-side and rebuilds the plan, policy, and receipt from fresh Shannon data.
- Exposure is a manual demo override; connected-wallet BTC/ETH valuation is not yet a verified production feed.
- Testnet liquidity can change materially between short windows; every preview must be refreshed and reauthorized.
- No video, user research, revenue, AUM, return, hedge-performance, or adoption metric is claimed. The public deployment is evidenced separately and does not imply production financial readiness.
- SHA-256 proves receipt integrity, not that every economic input is true; chain evidence supplies provenance.

See [`LIMITATIONS.md`](LIMITATIONS.md), [`docs/evidence/limitations.md`](docs/evidence/limitations.md), and the honest competitive mitigation section in [`docs/COMPETITIVE_POSITIONING.md`](docs/COMPETITIVE_POSITIONING.md#honest-outcomeguard-weaknesses-and-demo-mitigation).

## 16. SDK feedback

[`docs/SDK_FEEDBACK.md`](docs/SDK_FEEDBACK.md) records the exact reviewed SDK version, what works well, and recommendations including a unified preflight, consistent receipt shape, collateral metadata, environment bundles, branded nanosecond timestamps, and claimable-position discovery. It distinguishes documentation review from locally reproduced behavior.

## 17. License and attribution

OutcomeGuard is MIT licensed; see [`LICENSE`](LICENSE). The implementation uses `@somnia-chain/markets-sdk@0.28.1`. No competitor code, wording, UI, or branding was copied. Any future official bot-kit adaptations must be recorded file-by-file in `NOTICE.md` before release.

## 18. Release and submission status

| Gate | Status on 28 August 2026 |
| --- | --- |
| Research and architecture | Implemented; official-resource and competitor reports present |
| DreamDEX reads | Live Shannon market, book, venue, status, and parameters captured |
| Hedge engine | Deterministic baseline and property tests implemented |
| Policy and receipts | Shared evaluator, canonical receipts, CLI, and tamper tests implemented |
| Testnet execution | Dedicated-test-agent IOC mined, filled and position-reconciled; human wallet authorization remains a separate demo step |
| Settlement/redemption | **Pending verified position and terminal market evidence** |
| Product/deployment | Public preview healthy at `outcomeguard.tangvu.dev`; PM2 web/tunnel restore is configured after Windows logon |
| Submission | Text package, screenshots, and deployment URL ready; video and explorer transaction proof pending |

The internal judge-ready target is **7 September 2026**. **8 September 2026** is reserved for video, deployment verification, full-history secret scanning, public release, and DoraHacks submission.
