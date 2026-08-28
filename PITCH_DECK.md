# OutcomeGuard pitch deck

Format: 10 slides for a 2–3 minute live or recorded pitch. Visuals and external links remain pending until captured from verified artifacts.

---

## Slide 1 — OutcomeGuard

### Turn a downside concern into bounded, verifiable protection

Category vision: portfolio-aware rolling protection through DreamDEX Event Contracts on Somnia. This release implements one authorized protection window; rolling proposals are next.

Footer: Shannon testnet prototype · not financial advice · binary protection is not a perfect hedge

Speaker point: “Prediction markets ask what will happen. OutcomeGuard starts with the exposure you already have.”

---

## Slide 2 — The missing workflow

A treasury operator must connect seven questions:

```text
What do I own?
What loss concerns me?
Which contract maps to that window?
What can the book actually fill?
Does the plan obey policy?
What exactly did I authorize?
Can I prove execution and settlement matched?
```

Speaker point: Clicking DOWN is not a risk-management workflow.

---

## Slide 3 — Exposure in, protection plan out

Example intent:

> Protect my $1,000 ETH exposure for the next hour. Spend no more than 15 units of testnet collateral and accept no more than 2% slippage.

OutcomeGuard derives:

- eligible ETH window and settlement reference;
- executable DOWN book and exact lot/tick units;
- requested versus achievable protection;
- scenario P&L and premium-at-risk;
- a structured policy decision.

Visual: [`docs/demo/outcomeguard-desktop.png`](docs/demo/outcomeguard-desktop.png), explicitly labeled deterministic fixture.

---

## Slide 4 — Deterministic, not predictive

```text
underlying loss = exposure × adverse move
target protected loss = underlying loss × protection target
net DOWN payout = shares × (1 − executable price)
final shares = min(target, budget, depth, impact, risk caps), quantized down
```

AI may parse or explain. It cannot calculate, set permission, construct an order, or sign.

Speaker point: The same plan object drives the chart, policy, authorization, and receipt.

---

## Slide 5 — Safety is visible

Policy checks include:

- Shannon chain `50312` and explicit DreamDEX venue;
- onchain `Trading` status and expiry headroom;
- spread, depth, price impact, slippage, premium, and total risk;
- dynamic tick, lot, minimum, collateral, and gas facts;
- human approval, snapshot tolerance, and receipt reproducibility.

If a required fact is unknown, execution stops.

Real checkpoint result: the latest captured live ETH market passed market/plan checks but failed closed because existing premium risk, gas balance, and human approval were unknown. [Inspect the evaluation](docs/evidence/policy-evaluation.json).

---

## Slide 6 — Human authority, bounded execution

Required transaction-coordinator flow (not yet exercised at this checkpoint):

```text
refresh market + book + balances
  -> rerun the same policy engine
  -> bind chain, venue, market, order, budget, snapshot, and expiry
  -> sign
  -> bounded IOC
```

A submitted hash is not success. OutcomeGuard requires a successful mined receipt, fill evidence, and a reconciled position.

Visual: **PENDING — exact authorization plus verified explorer receipt**

---

## Slide 7 — Intent-to-settlement receipt

```text
intent
 -> portfolio snapshot
 -> market snapshot
 -> hedge calculation
 -> policy
 -> authorization
 -> execution
 -> position
 -> settlement
 -> redemption
```

Each stage is canonical RFC 8785 JSON with a SHA-256 digest. Later stages link the earlier digest; history is not invisibly mutated. Any changed sealed field fails verification.

Current evidence: [pre-execution receipt](docs/evidence/pre-execution-receipt.json). Execution and settlement are explicitly [not performed](docs/evidence/execution-receipt.json).

---

## Slide 8 — Why this is different

| Product | Starts from | OutcomeGuard distinction |
| --- | --- | --- |
| Rivo | Agent quality and capital allocation | Protects a user's existing exposure |
| Sluice | A user-selected order | Derives whether and how much to trade |
| Branch | Conditional multi-window thesis | Rolls protection from remaining exposure, not prediction success |
| PredicTrader | Forecast and social copy signal | No prediction or AI execution authority |

Full analysis: [Competitive Positioning](docs/COMPETITIVE_POSITIONING.md).

---

## Slide 9 — Evidence, including the refusal

Verified now:

- live Shannon chain `50312` market and order-book read;
- explicit DreamDEX venue and onchain `Trading` status;
- live tick, lot, minimum quantity, collateral metadata, and block number;
- deterministic hedge calculation;
- fail-closed policy result;
- verifiable pre-execution receipt;
- core unit/property/tamper tests.

Still pending:

- funded disposable signer and explicit authorization;
- real IOC fill and reconciled position;
- settlement/replay and redemption;
- public deployment and video. The full local release gate and responsive screenshots are complete.

Evidence index: [README § Real testnet proof](README.md#8-real-testnet-proof).

---

## Slide 10 — Future: a protection control plane

Today: one BTC or ETH exposure, one short window, one explicit authorization.

Next:

- wallet and treasury exposure adapters;
- expected-shortfall optimization across eligible windows;
- policy templates for DAO and protocol treasuries;
- rolling proposals with fresh human approval;
- independent receipt verification and optional digest anchoring.

Closing line: **OutcomeGuard turns Event Contracts from a prediction interface into a verifiable portfolio-protection primitive.**

External links: **PENDING — public application, repository, demo, and explorer proofs must be added only after verification.**
