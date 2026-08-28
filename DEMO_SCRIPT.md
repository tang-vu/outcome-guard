# OutcomeGuard 2–3 minute demo script

Target duration: **2:35**. This script separates fixture, live-read, live-execution, and verified-replay states. Do not record until every displayed external artifact has been independently checked.

## Required truth before recording

- The build shown is the release candidate that passed `npm run verify`.
- The mode label is visible at all times.
- A “live” market is read from Shannon chain `50312` and the explicit DreamDEX venue.
- Any transaction shown has a successful mined receipt and a reconciled position.
- Any historical settlement is labeled `VERIFIED REPLAY`, includes its real market/transaction evidence, and is never attributed to the current wallet unless true.
- Any redemption shown has a successful transaction or verified already-redeemed chain state.
- If execution or settlement proof is still unavailable, omit the claim and say it remains pending. Do not simulate it.

## 0:00–0:12 — The problem

**On screen:** OutcomeGuard hero, Shannon `50312`, mode badge.

**Narration:**

> “Prediction apps ask whether ETH goes up or down. OutcomeGuard starts with the exposure you already own and turns a downside concern into bounded, verifiable protection.”

## 0:12–0:30 — Existing exposure and intent

**Action:** Select ETH. Enter a $1,000 manual demo exposure. Choose one hour, 2% adverse move, maximum premium 15 tUSDC, 2% slippage, and 75% target protection.

**Narration:**

> “I want to protect a $1,000 ETH exposure for the next hour, spend at most 15 testnet tUSDC, and accept at most 2% slippage. The structured controls are authoritative; AI is not trusted with arithmetic or permissions.”

**Disclosure on screen:** Manual demo exposure; no claim that the connected wallet holds this amount.

## 0:30–0:50 — Live DreamDEX market

**Action:** Switch to or open the verified `LIVE READ` surface. Show asset, market ID, venue, book, spread, depth, expiry, settlement reference, freshness, block, and onchain `Trading` status.

**Narration:**

> “OutcomeGuard scopes the venue, discovers the eligible DreamDEX contract, then verifies status onchain. It reads the actual book and its tick, lot, minimum, collateral, expiry, and settlement reference. Missing or ambiguous state blocks execution.”

**Fallback:** If live endpoints fail, show the labeled fixture and say, “Shannon reads are unavailable, so OutcomeGuard has stopped live planning and entered deterministic fallback.” Do not call the fixture live.

## 0:50–1:12 — Derived hedge and scenario loss

**Action:** Click `Derive live plan`. Confirm the mode changes to `LIVE MARKET`; the server refetches the selected market ID before deriving the plan. Show requested shares, executable/quantized shares, binding budget/depth constraints, premium-at-risk, and scenario chart. If the endpoint fails, keep a persistent `DETERMINISTIC FIXTURE PLAN` label and state that the fallback does not consume the preceding live book.

**Narration:**

> “The engine starts with the portfolio loss scenario, derives DOWN shares, then caps and quantizes by premium, executable depth, price impact, spread, lot size, and portfolio limits. The chart and receipt use this same calculation object.”

Point to the basis-risk warning.

> “This is not a perfect hedge. The binary pays only if its own settlement rule resolves DOWN, so strike, timing, oracle, liquidity, and basis risk remain.”

## 1:12–1:30 — Policy gate

**Action:** Expand several checks. If the current book fails policy, leave it failed.

**Narration:**

> “Every control is visible, and required unknowns fail closed. Our latest captured market and plan checks passed, but existing premium risk, gas balance, and human approval were unknown, so OutcomeGuard refused execution. A deterministic refusal is safer and more credible than forcing a demo trade.”

If a different live market passes, state that it is a different timestamped snapshot; do not conceal the earlier refusal.

## 1:30–1:53 — Human authorization and real execution

**Prerequisite:** A passing fresh market, funded disposable Shannon account, explicit wallet authorization, and a release candidate whose transaction coordinator has been verified to invoke the guarded adapter.

**Action:** Show exact order, maximum premium, collateral symbol/address, market ID, venue, chain, snapshot tolerance, and expiry. Authorize. Show stages `SUBMITTED`, `CONFIRMED`, and `RECONCILED`, then open the Shannon explorer.

**Narration:**

> “The execution design refreshes the market and reruns the shared policy engine immediately before a transaction signature. The signed envelope binds this market, price, size, budget, snapshot, nonce, and deadline. A hash alone is not confirmation: OutcomeGuard requires a successful mined receipt, fill evidence, and the resulting onchain position.”

**If prerequisite is not met:** Replace this segment with:

> “This checkpoint cryptographically verifies an intent signature, but it does not treat that signature as transaction authorization. Live execution is pending a funded disposable Shannon signer and a verified transaction coordinator. The repository makes no transaction claim.”

Show [`docs/evidence/execution-receipt.json`](docs/evidence/execution-receipt.json) with `NOT_PERFORMED`. Do not show a mock transaction animation.

## 1:53–2:13 — Receipt integrity and tamper proof

**Action:** Open the receipt explorer/raw JSON. Copy the digest. Run the CLI verifier. Change one copy of a non-secret field and verify that the copy fails.

**Narration:**

> “The original intent, market snapshot, calculation, policy, authorization, and chain evidence form canonical JSON with a SHA-256 digest. Change any sealed field and verification fails. Later lifecycle records link this digest instead of rewriting history.”

## 2:13–2:29 — Settlement and redemption

**Action:** Switch to a persistent `VERIFIED REPLAY` label. Show a real finalized market, earlier receipt link, outcome, claimable balance, and real redemption evidence.

**Narration:**

> “For a complete lifecycle inside a short demo, this section is a verified historical replay—not the live order we just previewed. DreamDEX's terminal state and redemption evidence close the receipt chain.”

**If proof is unavailable:** Say:

> “Settlement and redemption proof are still pending, so this build stops at the last verified stage.”

Do not imply the blocker JSON is settlement evidence.

## 2:29–2:35 — Vision

**On screen:** Exposure → protect → verify.

**Narration:**

> “OutcomeGuard turns Event Contracts from a prediction interface into a policy-bound protection layer for wallets and treasuries.”

## Final link card

- Public app: **PENDING**
- GitHub: **PENDING public-release decision and history scan**
- Explorer transaction: **PENDING successful execution**
- Receipt digest: insert from the final immutable evidence artifact

Do not spend video time explaining folders. Keep cursor movement deliberate, use 125–150% zoom where needed, and keep text captions on for every mode change and external proof.
