# Competitive positioning

Research snapshot: 28 August 2026. This review uses each project's public repository as the primary source. A repository's own assertion is not treated as independently verified unless it links reproducible evidence such as a transaction, test report, or proof artifact.

## Category position

OutcomeGuard's category is **portfolio-aware rolling protection through Event Contracts**.

The important distinction is the starting point. A prediction product starts with a view about whether a market will settle UP or DOWN. A trading terminal starts with an order the user already wants to place. OutcomeGuard starts with an existing BTC or ETH exposure, an adverse-move scenario, a protection target, a time horizon, and a premium limit. It then deterministically derives a bounded hedge candidate, shows the portfolio result before and after protection, evaluates the same policy before preview and signing, and links the authorized action to execution, settlement, and redemption evidence.

OutcomeGuard must not claim that a binary Event Contract perfectly hedges spot exposure. Its payout is nonlinear, its settlement reference may differ from the user's exposure valuation, and its expiry creates timing and basis risk. The product is short-duration downside protection with explicit limitations, not guaranteed insurance.

## Competitor review

### Rivo

Primary evidence: [repository and README](https://github.com/Rzbyte/Rivo), [architecture](https://github.com/Rzbyte/Rivo/blob/main/docs/ARCHITECTURE.md), [evidence artifacts](https://github.com/Rzbyte/Rivo/tree/main/docs/evidence), and [methodology](https://github.com/Rzbyte/Rivo/blob/main/docs/METHODOLOGY.md).

**What it does.** Rivo is DreamDEX market intelligence and agent validation infrastructure. It measures how Event Contract probabilities calibrate against settled outcomes, evaluates whether a forecasting agent has economic rather than merely predictive edge, supports live shadow evaluation and experimental testnet execution, applies portfolio constraints, and reconciles positions against chain state.

**Strongest supported claim.** Rivo has the strongest evidence discipline in this field. Its README links calibration artifacts, reports an unfavorable out-of-sample trading result alongside favorable forecasting metrics, distinguishes hypothetical from submitted and confirmed activity, and links a real Shannon transaction and confirmed block. Its core category claim is that an agent should be measured before it deserves capital.

**OutcomeGuard must not duplicate.** Do not build another probability-calibration dashboard, forecasting model evaluator, Kelly allocator, shadow-trading laboratory, or “prove the agent” product. Market calibration may inform limitations, but it is not OutcomeGuard's product.

**Weakness and opportunity.** Rivo begins with a strategy and capital allocation. It does not begin with a user's spot exposure and derive a protection purchase from a stated downside-loss objective. OutcomeGuard can differentiate through exposure-first sizing, scenario loss before and after protection, explicit basis-risk education, human authorization, and an intent-to-settlement receipt chain. Rivo nonetheless establishes the standard OutcomeGuard must meet for honest evidence, chain reconciliation, and failure-state naming.

### rampart

Primary evidence: [repository and README](https://github.com/edycutjong/rampart), [testnet evidence trail](https://github.com/edycutjong/rampart/blob/main/DEMO.md), and [SDK feedback](https://github.com/edycutjong/rampart/blob/main/SDK_FEEDBACK.md).

**What it does.** rampart creates contract-owned resting DreamDEX orders with no exposed cancel, reduce, or operator-grant path during a lock. Its offchain engine classifies visible book depth as `FIRM`, `PULLABLE`, or `UNVERIFIED` using owner type, bytecode analysis, and an attested code-hash set.

**Strongest supported claim.** Its liquidity-quality primitive is distinctive and unusually well supported. The repository links a public reverted cancellation transaction, includes reproducible RPC checks and adversarial contracts, and reports Foundry, Halmos, Slither, CodeQL, differential SDK checks, and 93 passing tests. It also carefully limits `FIRM` to attested code inside a lock window rather than claiming a universal proof of irrevocability.

**OutcomeGuard must not duplicate.** Do not reproduce the firm-quote contract, bytecode-attestation system, “percentage of book that cannot be withdrawn” metric, or irrevocable-liquidity narrative.

**Weakness and opportunity.** rampart is narrow maker and liquidity infrastructure. It does not discover a wallet exposure, design a hedge, execute a bounded taker order, quantify portfolio loss reduction, or maintain an intent receipt through settlement. OutcomeGuard should consume live executable depth conservatively while owning the separate portfolio-protection problem.

### Branch

Primary evidence: [repository and README](https://github.com/nftkingiii/branch), [proof matrix](https://github.com/nftkingiii/branch/blob/main/PROOF_MATRIX.md), and [threat model](https://github.com/nftkingiii/branch/blob/main/THREAT_MODEL.md).

**What it does.** Branch expresses a conditional multi-window thesis. The first DreamDEX leg executes immediately; each later leg remains locked until the previous market settles to the expected outcome. A continuation binds a fresh market generation and requires a new injected-wallet approval.

**Strongest supported claim.** Branch's proof matrix documents a real two-window Shannon lifecycle: a first DOWN fill won and was redeemed, a second UP fill used a different market generation, and the second result correctly stopped the remaining path after an outcome mismatch. The matrix also identifies missing live void proof and missing user-need research rather than silently claiming completeness.

**OutcomeGuard must not duplicate.** Do not build a branching thesis composer or condition later bets on whether an earlier prediction won. A rolling protection proposal must follow remaining exposure and the next eligible protection window, rerun policy against fresh data, and require fresh approval.

**Weakness and opportunity.** Branch is thesis-first, not exposure-first. It does not quantify a user's spot loss, select protection against that loss, show a protection ratio, or create a canonical intent-to-lifecycle receipt. Its fresh-market binding, explicit approval, durable history, and hard-stop behavior are nevertheless valuable quality benchmarks.

### Sluice Markets

Primary evidence: [repository and README](https://github.com/Tajudeeen/sluice), including its documented [pre-sign checks and trust boundaries](https://github.com/Tajudeeen/sluice/blob/main/README.md#what-is-verified-before-signing).

**What it does.** Sluice is a Shannon DreamDEX trading terminal. Its `Safe Size` flow starts from a user-selected order and maximum loss, then computes the largest size that passes book depth, slippage, exposure, expiry, collateral, and order-size checks. It refreshes the book and applies the same policy again before prompting the wallet.

**Strongest supported claim.** Sluice presents a clear bounded-order guardrail for a direct trading interface. It combines IOC execution with visible depth and price-impact checks, per-market and portfolio caps, and explicit wallet approval. Its README correctly states that these are browser-side controls which a direct protocol caller can bypass.

**OutcomeGuard must not duplicate.** Do not make “select an order and cap its size” the product. Do not present a generic market terminal or use `Safe Size` positioning.

**Weakness and opportunity.** Sluice starts from the trade and constrains it. OutcomeGuard starts from portfolio exposure and derives whether, where, and how much protection is justified. The demonstrable differences must be scenario P&L, target protection, premium and liquidity constraints, basis-risk disclosure, receipt integrity, settlement reconciliation, and exposure-aware rolling proposals.

### Market Dungeon

Primary evidence: [repository and README](https://github.com/CryptoMickle/market-dungeon) and its [integration documentation](https://github.com/CryptoMickle/market-dungeon/tree/main/docs).

**What it does.** Market Dungeon is a read-only fantasy roguelite in which a BTC Event Contract outcome affects dungeon progression. Its judge mode makes the player choose UP or DOWN before the server selects a finalized market, seals the selection with AES-256-GCM, publishes a salted commitment, validates a bounded deterministic combat transcript, and then reveals and verifies the recorded market outcome.

**Strongest supported claim.** It turns a verified historical settlement into a memorable two-minute experience without pretending the replay is a live transaction. The commitment-and-reveal design prevents choosing the historical market after seeing its result, and the repository explicitly says that the app requests no wallet signature, approval, trade, or redemption.

**OutcomeGuard must not duplicate.** Do not use dungeon, omen, sealed-prediction, or entertainment framing. Do not turn the judge flow into a gamified UP/DOWN guess.

**Weakness and opportunity.** It is intentionally read-only and uses Somnia mainnet data, so it does not demonstrate testnet order execution, portfolio protection, reconciliation, or redemption. Its key lesson is presentation resilience: OutcomeGuard's settled historical path should likewise be cryptographically checkable and unmistakably labeled as replay rather than live execution.

### PredicTrader AI

Primary evidence: [repository and README](https://github.com/binasalama12/predictrader-ai), [bot source](https://github.com/binasalama12/predictrader-ai/tree/main/bot), [application libraries](https://github.com/binasalama12/predictrader-ai/tree/main/lib), and [SDK feedback](https://github.com/binasalama12/predictrader-ai/blob/main/FEEDBACK.md).

**What it does.** PredicTrader combines an AI-oracle trading bot and social copy-trading interface. Its described three-part model estimates fair value from spot price, reference price, volatility, momentum, and book staleness, then can place IOC orders. Its dashboard presents signals and copy-trading, and its worker describes finalized-market discovery and redemption.

**Strongest supported claim.** The repository contains a coherent sponsor-specific agent architecture and explicitly addresses several DreamDEX sharp edges: onchain status checks, integer tick prices, nanosecond expiry, lot quantization, market-ID state, and finalized-market scans. Its copy-trading loop also provides a clear business narrative.

**Evidence caveat.** The README does not surface a concrete transaction and evidence bundle comparable to Rivo, Branch, or rampart. Claims that stale quotes produce profit or that the code is “mainnet ready” should therefore be treated as project assertions, not demonstrated results.

**OutcomeGuard must not duplicate.** Do not compete on price prediction, signal confidence, stale-quote alpha, AI oracle output, copy-trading, social feeds, or leaderboards.

**Weakness and opportunity.** Prediction performance is not evidenced in the repository. The documented worker uses a private key and exposes a testnet-or-mainnet switch, whereas OutcomeGuard must be testnet-only and must not let AI determine arithmetic, permission, or transaction construction. OutcomeGuard can win on deterministic protection math, constrained intent parsing, signed human authorization, and independently verifiable receipts.

### Prediction by Manav

Primary evidence: [repository](https://github.com/patelmanavjee-gif/Prediction-by-Manav), [application shell](https://github.com/patelmanavjee-gif/Prediction-by-Manav/blob/main/src/App.tsx), and [server implementation](https://github.com/patelmanavjee-gif/Prediction-by-Manav/blob/main/server.ts).

**What it does.** The repository presents a broad AI-agent marketplace and social prediction terminal with market browsing, an agent studio, copy portfolios, social posts, quests, groups, leaderboards, widgets, a bot terminal, and Gemini-assisted market creation and resolution.

**Strongest supported claim.** Its strongest repository-supported quality is breadth of interface concepts and an Express/Vite prototype with a Gemini heuristic fallback. That is evidence of a broad interactive prototype, not of a genuine DreamDEX execution lifecycle.

**Evidence caveat.** The root has no substantive README or evidence package. The server embeds synthetic markets, wallet balances, performance statistics, transaction-like hashes, and social activity. It also reports chain ID `50311`, not Shannon's required `50312`. No embedded ROI, win-rate, volume, transaction, or onchain-integration claim should be repeated as fact.

**OutcomeGuard must not duplicate.** Avoid a kitchen-sink agent marketplace, synthetic performance leaderboard, quest system, AI market creation, or unverified transaction-looking UI. A narrow workflow supported by real artifacts is more credible than feature breadth.

**Weakness and opportunity.** The repository's breadth dilutes the main user story and its fixtures weaken trust. OutcomeGuard can differentiate by making every number traceable to a market snapshot, hedge calculation, policy result, chain receipt, or explicitly labeled deterministic fixture.

## Defensible differentiation

No reviewed competitor implements the complete exposure-first chain below:

```text
existing BTC/ETH exposure
  -> explicit adverse scenario and loss objective
  -> deterministic Event Contract selection and sizing
  -> before/after portfolio scenario loss
  -> versioned fail-closed policy
  -> human authorization bound to a market snapshot
  -> bounded Shannon IOC execution
  -> chain and indexer reconciliation
  -> settlement and redemption
  -> linked canonical receipt digests
```

OutcomeGuard's defensible product claims should be limited to:

- It starts from portfolio exposure rather than a prediction or preselected trade.
- It derives protection under explicit premium, liquidity, spread, slippage, expiry, venue, and risk constraints.
- It exposes the same deterministic calculation in the chart, policy evaluation, and receipt.
- It invalidates authorization when the market snapshot moves beyond tolerance.
- It requires human authorization for execution and cannot resolve to mainnet.
- It shows binary and basis risk rather than claiming perfect hedging.
- It follows evidence through confirmation, position reconciliation, settlement, and redemption.
- It may propose a new protection window, but it does not silently roll or sign.

## Judging-criteria comparison

Ratings below are qualitative assessments of public repository evidence, not scores assigned by the hackathon judges.

| Project | Technical implementation (25%) | Innovation (20%) | UX and design (20%) | Business and ecosystem impact (20%) | Presentation (15%) |
| --- | --- | --- | --- | --- | --- |
| Rivo | Very strong: broad integration, chain reconciliation, linked evidence, extensive claimed tests | Strong: economic agent validation and venue research | Strong but information-dense | Strong agent-capital and research infrastructure story | Strong, with unusually honest positive and negative results |
| rampart | Very strong: contract, adversarial, formal/static, and live-chain evidence | Very strong: onchain firmness classification is distinctive | Moderate: focused evidence viewer rather than broad product journey | Moderate: valuable liquidity primitive with a narrow adoption path | Strong, centered on one memorable failed-cancel proof |
| Branch | Strong: multi-window lifecycle, wallet approval, settlement and redemption evidence | Strong: conditional cross-window path | Strong, cinematic, and lifecycle-aware | Moderate: proof matrix explicitly lacks user-need evidence | Strong public demo and concise proof matrix |
| Sluice | Strong: real market terminal and shared preview/pre-sign guardrails | Moderate: safe sizing improves a familiar terminal pattern | Strong and immediately usable | Moderate to strong consumer safety proposition | Moderate to strong; clear bounded-order story |
| Market Dungeon | Moderate: strong verified reads and replay security, intentionally no writes | Very strong: unusual game/Event Contract composition | Very strong and memorable | Low to moderate outside entertainment/onboarding | Very strong two-minute judge experience |
| PredicTrader AI | Moderate: credible architecture claims but weaker linked execution proof | Strong: oracle-plus-social-copy combination | Strong dashboard proposition | Strong viral and fee narrative, not validated traction | Strong pitch; evidence must be scrutinized |
| Prediction by Manav | Weak: fixture-heavy prototype and wrong Shannon chain identifier | Low to moderate: broad combination of familiar marketplace/social features | Strong breadth, but the primary journey is diffuse | Speculative and based on synthetic activity | Moderate to strong visual surface, weak proof |
| OutcomeGuard target | Very strong: deterministic engines, identical policy paths, real Shannon lifecycle, tamper tests | Very strong: exposure-derived short-duration protection and linked receipts | Very strong: one sub-90-second protection story plus honest replay | Strong treasury/wallet risk-management wedge and SDK feedback | Very strong if the video shows one live proof and one clearly labeled settled lifecycle |

## Honest OutcomeGuard weaknesses and demo mitigation

| Weakness | Why it matters | Honest demo mitigation |
| --- | --- | --- |
| Binary contracts are an imperfect hedge | The payout has discontinuity and basis risk; the reference, expiry, and wallet's valuation may differ | Show unchanged, favorable, and several adverse scenarios; state premium-at-risk and break-even behavior; display a persistent basis-risk warning |
| Testnet liquidity may be shallow or absent | A mathematically desirable hedge may not be executable | Show requested versus executable protection, bind size to visible depth, fail closed, and fall back to a timestamped verified market snapshot without claiming a fill |
| Settlement may not occur during a short video | A live order cannot demonstrate the whole lifecycle in two to three minutes | Use live discovery and preview, then switch to a clearly labeled historical settled receipt whose transaction and settlement evidence are independently verifiable |
| A worker cannot autonomously use an injected browser wallet | Human signing and durable monitoring are different trust domains | Make the browser authorization explicit; restrict any worker signer to a dedicated disposable Shannon account and keep rolling actions proposal-only unless separately authorized |
| Natural-language parsing can be wrong or manipulated | A persuasive explanation must not alter risk limits or execution | Display the normalized schema, offer manual controls, validate all fields, and keep arithmetic and policy independent of the language model |
| Public RPC and indexer data can disagree or lag | False status, stale depth, and missed fills could misrepresent risk | Verify write-critical state onchain, record both sources, treat missing reads as unknown, and show reconciliation state rather than silently choosing one source |
| A receipt digest proves integrity, not economic correctness | A perfectly hashed bad input is still bad | Include source references, timestamps, policy version, market/venue/network identifiers, and reproducible calculation inputs in every receipt |
| No production or mainnet operating history | The project cannot honestly claim institutional reliability | Label the product as Shannon testnet software, avoid performance and insurance claims, and frame the business case as a validated prototype direction |

## Demo positioning

The demo should make the competitive distinction visible before discussing implementation:

1. Show the wallet's existing ETH or BTC exposure.
2. State a downside concern, time horizon, premium cap, and slippage limit.
3. Show OutcomeGuard deriving the Event Contract side and size from that exposure.
4. Compare portfolio scenario loss before and after, including premium loss and basis risk.
5. Show the shared policy gate and exact human authorization payload.
6. Show a real Shannon confirmation and reconciled position if one is available.
7. Verify the receipt digest, demonstrate tamper failure, and continue into an explicitly labeled settled replay.

The concise comparison to use in narration is: **Rivo evaluates whether an agent deserves capital. Sluice constrains a trade the user already selected. Branch sequences a conditional thesis. OutcomeGuard derives bounded protection from the portfolio exposure that already exists.**
