# OutcomeGuard 2–3 minute demo script

Target duration: **2:35**. This script separates fixture, live-read, live-execution, and verified-replay states. Do not record until every displayed external artifact has been independently checked.

## Required truth before recording

- The build shown is the release candidate that passed `npm run verify`.
- The mode label is visible at all times.
- A “live” market is read from Shannon chain `50312` and the explicit DreamDEX venue.
- Any transaction shown has a successful mined receipt and a reconciled position.
- Any historical settlement is labeled `VERIFIED REPLAY`, includes real market and direct onchain terminal-state evidence, and is never attributed to the current wallet unless true.
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

**Prerequisite:** A passing fresh market, funded disposable Shannon account, explicit wallet authorization, and the verified one-shot transaction coordinator.

**Action:** Show exact order, maximum premium, collateral symbol/address, market ID, venue, chain, snapshot tolerance, and expiry. Authorize. Show stages `SUBMITTED`, `CONFIRMED`, and `RECONCILED`, then open the Shannon explorer.

**Narration:**

> “The execution worker independently verifies the receipt and exact wallet-signed mandate, durably claims it once, refreshes the market, and reruns the shared policy engine. The mandate binds chain, venue, market, raw price, size, premium, snapshot, worker signer, pool nonce, and deadline. A hash alone is not confirmation: OutcomeGuard requires a successful mined receipt, fill evidence, and the resulting onchain position.”

**If prerequisite is not met:** Replace this segment with:

> “This checkpoint can cryptographically authorize one exact IOC mandate, but no disposable Shannon signer is funded and no transaction has been submitted. The repository makes no transaction claim.”

Show [`docs/evidence/execution-receipt.json`](docs/evidence/execution-receipt.json) with `NOT_PERFORMED`. Do not show a mock transaction animation.

## 1:53–2:13 — Receipt integrity and tamper proof

**Action:** Open the receipt explorer/raw JSON. Copy the digest. Run the CLI verifier. Change one copy of a non-secret field and verify that the copy fails.

**Narration:**

> “The original intent, market snapshot, calculation, policy, authorization, and chain evidence form canonical JSON with a SHA-256 digest. Change any sealed field and verification fails. Later lifecycle records link this digest instead of rewriting history.”

## 2:13–2:29 — Settlement and redemption

**Action:** Switch to `VERIFIED OWNED LIFECYCLE`. Show market `…eec6`, the bounded IOC, reconciled `4.171 NO`, onchain `Resolved / DOWN`, `4.171 tUSDC` claimable, redemption transaction, zero post-redemption winning-token balance, and linked receipt digest.

**Narration:**

> “This is an owned dedicated-test-agent lifecycle on Shannon. The hedge filled, resolved DOWN, exposed 4.171 tUSDC claimable, redeemed successfully, and reconciled the winning position to zero. Every stage links to the prior receipt digest.”

**If the replay endpoint is unavailable or its digest fails:** Say:

> “Terminal evidence is unavailable, so this build stops at the last verified stage.”

Do not represent the dedicated test agent as a human wallet.

## 2:29–2:35 — Vision

**On screen:** Exposure → protect → verify.

**Narration:**

> “OutcomeGuard turns Event Contracts from a prediction interface into a policy-bound protection layer for wallets and treasuries.”

## Final link card

- Public app: **https://outcomeguard.tangvu.dev**
- Demo video: **https://outcomeguard.tangvu.dev/demo/outcomeguard-demo.mp4**
- GitHub: **PENDING public-release decision and history scan**
- Explorer transaction: **`0xabc2f01852be3f1d75ec643524330d47dff2a50bb2ad890b85814e924e8abe99`**
- Redemption transaction: **`0x7021c55eb19271a22404f94c1ea5c639331a147ec2161ee3fbb07d7e4f81effc`**
- Receipt digest: **`0xc272e960d137b04b34dd25be22d411e084e3904d0c7c43ec583902ae72ce8205`**

Do not spend video time explaining folders. Keep cursor movement deliberate, use 125–150% zoom where needed, and keep text captions on for every mode change and external proof.
