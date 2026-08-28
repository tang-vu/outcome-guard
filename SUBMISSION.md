# OutcomeGuard — DoraHacks submission draft

Status: judge-facing copy prepared on 28 August 2026. Fields marked **PENDING** require an external deployment, wallet action, recording, or submission decision and must not be replaced with invented data.

## Project name

OutcomeGuard

## One-line description

OutcomeGuard turns an existing BTC or ETH downside concern into policy-bound short-duration protection using DreamDEX Event Contracts, with a verifiable receipt from intent through settlement.

## Short description

Most Event Contract products begin with a prediction or an order. OutcomeGuard begins with exposure already in a wallet or treasury. A user supplies the asset, USD exposure, adverse scenario, horizon, premium cap, slippage limit, and protection target. The deterministic engine inspects a DreamDEX market and order book, derives executable DOWN protection, shows portfolio P&L before and after, and evaluates a versioned fail-closed policy. The guarded write design requires that same engine to pass again against fresh state before transaction signing; the current checkpoint has not yet wired or exercised that coordinator. Each lifecycle stage is sealed into canonical JSON and linked by SHA-256 digest.

OutcomeGuard is Shannon-testnet software and not financial advice. Binary protection is nonlinear and carries strike, timing, oracle, liquidity, and basis risk.

## Problem

A trader can click DOWN. A treasury operator needs to answer different questions: how much exposure is at risk, which short-duration contract maps to the concern, what premium is acceptable, how much liquidity is executable, what happens across scenarios, and what evidence proves that the final action matched the original authorization?

Today those steps are fragmented across portfolio data, market books, policy spreadsheets, wallets, explorers, and settlement tools. That makes automation hard to trust and easy to misrepresent.

## Solution

OutcomeGuard provides one lifecycle:

1. Capture or read BTC/ETH exposure.
2. Discover and verify the eligible DreamDEX Event Contract.
3. Read the live book, venue parameters, settlement reference, expiry, and onchain status.
4. Derive a hedge with deterministic scenario math.
5. Fail closed on premium, spread, depth, impact, slippage, expiry, venue, freshness, balances, or authorization failures.
6. Require an exact human wallet authorization.
7. Submit a bounded IOC on Shannon and require a successful receipt.
8. Reconcile the resulting position, follow settlement, redeem, and link every stage by receipt digest.

AI is optional and outside the arithmetic and authority boundary. The core works with structured input and deterministic fixtures.

## Why DreamDEX Event Contracts

Event Contracts provide bounded-premium, short-duration outcome exposure with transparent order books and onchain settlement. That makes them useful as imperfect portfolio protection, not only as prediction instruments. OutcomeGuard uses the current official `@somnia-chain/markets-sdk@0.28.1`, Shannon chain ID `50312`, explicit venue scoping, onchain Trading checks, bigint tick/lot construction, IOC orders, mined-receipt verification, finalized-market discovery, and explicit redemption.

## What is implemented

- Responsive exposure/protection workspace with manual BTC/ETH exposure controls, a live Shannon read panel, and opt-in server-side live plan derivation.
- Deterministic liquidity- and budget-aware hedge engine with before/after scenarios and basis-risk warning.
- Versioned policy engine exposing one shared preview/pre-sign evaluator, plus a guarded adapter boundary that rejects missing or failed authorization envelopes.
- Shannon-only DreamDEX adapter for live discovery, onchain status, books, parameters, exact-unit IOC preparation/execution, position reads, finalized discovery, and redemption.
- Injected-wallet intent-signature surface with server-side signer recovery, nonce, deadline, and linked receipt; it is not represented as transaction authorization.
- RFC 8785 canonical receipt sealing, SHA-256 verification, linked lifecycle stages, CLI, and receipt route.
- Dry-run/fixture worker with structured logs, health endpoint, serialized cycles, and graceful shutdown.
- Live-read evidence captured from Shannon plus explicit `NOT_PERFORMED` external-action blockers.

## Verified evidence

- [Environment](docs/evidence/environment.json)
- [Live Shannon market snapshot](docs/evidence/market-snapshot.json)
- [Hedge plan](docs/evidence/hedge-plan.json)
- [Policy evaluation](docs/evidence/policy-evaluation.json)
- [Pre-execution receipt](docs/evidence/pre-execution-receipt.json)

The captured live plan passes the market and sizing controls. Execution remains blocked because existing total premium risk and gas balance are unknown, and no human authorization has been supplied. That is expected fail-closed behavior, not a claimed trade.

No order, fill, settlement, or redemption is yet claimed. The repository says so explicitly in [execution evidence](docs/evidence/execution-receipt.json) and [settlement evidence](docs/evidence/settlement-receipt.json).

## Differentiation

OutcomeGuard is not a prediction chatbot, agent evaluator, copy-trading product, game, firm-liquidity primitive, conditional thesis sequencer, or safe-size terminal. It starts from portfolio exposure and derives bounded protection.

The complete comparison to Rivo, rampart, Branch, Sluice, Market Dungeon, PredicTrader AI, and Prediction by Manav is in [Competitive Positioning](docs/COMPETITIVE_POSITIONING.md).

## Judging criteria

### Technical implementation — 25%

Exact-unit DreamDEX integration, onchain/indexer trust split, chain and venue fail-closed gates, liquidity-aware hedge sizing, shared policies, append-only receipts, tamper tests, and a local release command. A real wallet lifecycle remains pending and will be claimed only after explorer and reconciliation evidence exist.

### Innovation and originality — 20%

The innovation is exposure-derived protection: convert a portfolio loss objective into a bounded Event Contract plan, then bind the original intent to execution and settlement. Receipts support the product; they are not the whole product.

### UX and design — 20%

The intended full judge journey follows one story: exposure, concern, live market, before/after loss, visible policy, exact authorization, transaction progress, and receipt. The current build defaults to a labeled fixture but can explicitly derive the plan from a selected live market after a server-side refetch; its intent-signature prototype is not transaction authorization, and transaction progress is pending. Failure reasons are never hidden.

### Business and ecosystem impact — 20%

OutcomeGuard reframes Event Contracts as treasury and wallet risk infrastructure. The potential users are DAO treasuries, protocol operators, market makers, funds, and individuals who need bounded short-duration protection. No traction, revenue, AUM, or return metric is claimed. [SDK feedback](docs/SDK_FEEDBACK.md) contributes reusable ecosystem findings.

### Presentation and demo — 15%

The planned 2–3 minute demo spends its time on the user problem and proof: exposure, derived plan, scenario loss, policy gate, explicit wallet action, explorer confirmation, receipt tamper failure, and a clearly labeled settled lifecycle. See [Demo Script](DEMO_SCRIPT.md) and [Video Shot List](VIDEO_SHOTLIST.md).

## Security model

- Shannon-only writes; chain ID `5031` cannot construct an execution request.
- Injected browser wallet or dedicated disposable testnet worker signer.
- Missing reads and conflicting state fail closed.
- AI cannot perform arithmetic, set policy, build a transaction, or sign.
- A tx hash is not confirmation; a successful mined receipt and reconciled chain state are required.
- Receipts contain no private keys or tokens.

See [Threat Model](docs/THREAT_MODEL.md).

## Known limitations

- Binary payout does not perfectly hedge spot exposure.
- The composer defaults to deterministic fixture data; `Derive live plan` refetches the selected market server-side and recomputes the live plan, while a labeled fixture remains available for endpoint failure.
- Wallet exposure discovery, real OutcomeGuard execution, reconciliation, settlement replay, redemption, and public deployment are not complete at this checkpoint. Desktop and 390 px mobile E2E release proof is complete.
- Testnet books may be too shallow or wide to pass policy.
- The full local release gate passes; public deployment and wallet lifecycle remain pending.

## Links

- Source repository: **PENDING — insert public GitHub URL only after full-history secret scan and public-release decision**
- Live application: **PENDING — no deployment URL claimed**
- Demo video: **PENDING — no video URL claimed**
- Testnet transaction: **PENDING — insert only after successful mined receipt and position reconciliation**
- Redemption transaction: **PENDING — insert only after successful receipt or verified already-redeemed chain state**
- DoraHacks page: **PENDING — insert after account authorization/submission**

## Submission checklist

- [x] `npm ci` succeeds from the committed lockfile.
- [x] `npm run verify` passes and a timestamped test report is present.
- [x] Web composer clearly labels fixture/live modes; `/api/markets` exposes real reads and `Derive live plan` refetches and recomputes server-side.
- [ ] Real bounded Shannon order has explorer, receipt, fill, and position evidence.
- [ ] Settlement or verified historical replay is present and labeled.
- [ ] Redemption is proved or honestly marked pending.
- [x] Desktop and 390 px mobile judge paths pass.
- [ ] Deployment health checks pass.
- [ ] Repository and full git history pass secret scanning.
- [ ] Public GitHub, deployment, video, explorer, and DoraHacks links are inserted.
- [ ] Every numerical submission claim points to reproducible evidence.

Internal target: judge-ready on **7 September 2026**; release verification and submission on **8 September 2026**.
