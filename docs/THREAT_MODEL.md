# Threat Model

Last reviewed: 2026-08-28. OutcomeGuard is testnet prototype software, not financial advice. Binary Event Contracts do not perfectly hedge spot exposure.

## Security objectives

1. No transaction can be signed unless it targets Somnia Shannon chain ID `50312`, the configured DreamDEX venue, and a fresh Trading market.
2. Premium, size, price impact, spread, slippage, expiry, and total exposure remain within the user's authorized limits after exact quantization.
3. A failed or unknown mandatory policy cannot reach a signer.
4. A submitted transaction cannot be called confirmed without a successful mined receipt and reconciled evidence.
5. Intent, calculation, policy, authorization, execution, settlement, and redemption remain linked by tamper-evident receipt digests.
6. No secret or wallet material enters source control, logs, receipts, browser bundles, or evidence.

## Assets and adversaries

Protected assets include the disposable testnet wallet, user authorization, token allowances, premium budget, position and claim rights, policy configuration, receipt history, evidence artifacts, and the credibility of the demo. Adversaries include a malicious site or dependency, compromised worker, hostile prompt/input, stale or malicious indexer/RPC, front-running actor, unauthorized maintainer, and accidental operator error.

## Threat register

| ID | Threat | Impact | Required mitigation | Verification evidence |
| --- | --- | --- | --- | --- |
| T01 | Private-key leakage through env, logs, errors, fixtures, or client bundle | Wallet compromise | Injected browser wallet; disposable worker key; redacting logger; environment allowlist; `.env*` ignored; full tree and git-history secret scan | Secret-scan report and bundle inspection |
| T02 | Mainnet misconfiguration | Real-fund loss | Hard assertion `chainId === 50312` in environment, policy, signer, and receipt; no mainnet write mode or address fallback | Test that chain 5031 cannot construct signer request |
| T03 | Malicious or stale indexer data | Wrong market/order | Use indexer only for discovery/history; freshness policy; validate all fields; direct on-chain status/params/balance reads before every write | Adapter integration tests with stale/conflicting fixtures |
| T04 | Compromised or inconsistent RPC | False state or confirmation | Allowlisted HTTPS/WSS hosts; chain-ID check; coherent block context where possible; receipt plus decoded expected contract events; optional second read for high-risk transitions | RPC mismatch and false-confirmation tests |
| T05 | Market rollover and recycled pool address | Trade wrong window | Key state and authorization by `marketId`; bind expiry and settlement question; re-read registry mapping immediately before sign | Rollover fixture invalidates approval |
| T06 | Floating-point and decimal error | Budget breach or rejected order | Integer/decimal-string core; dynamic token decimals, tick, lot, min quantity; directional quantization; post-quantization invariant checks | Property tests around tick/lot/budget boundaries |
| T07 | Excess allowance or allowance abuse | Token loss | Prefer exact/limited allowance where venue permits; display spender and amount; verify spender against allowlist; document/revoke residual test allowance | Allowance preflight test and evidence |
| T08 | Transaction replay or stale authorization | Unauthorized later execution | Domain-separated authorization hash with chain, signer, market ID, order, snapshot digest, nonce, and short expiry; one-time state | Replay and expired-approval tests |
| T09 | Frontend tampering | Hidden policy bypass or changed order | Recompute plan and policy in shared trusted package; signer request generated from approved canonical payload, not UI fields | Tampered-client test cannot reach signer |
| T10 | Receipt tampering or canonicalization ambiguity | False audit trail | Versioned schema; deterministic JSON canonicalization; SHA-256; exclude digest field during defined digest operation; linked immutable stages | One-field mutation and key-order tests |
| T11 | SSRF through configurable endpoints | Internal-network access/data theft | Production endpoint allowlist; parse URL; HTTPS/WSS only; block credentials, localhost, private/link-local IPs and redirects; fixed timeouts/body caps | URL validator tests |
| T12 | Prompt injection in natural-language intent | Policy bypass or arbitrary tool call | Treat text as data; schema-constrained parser; allowed enum/range validation; deterministic manual fallback; AI never calculates, signs, or selects permissions | Adversarial intent fixtures |
| T13 | Unauthorized policy change | Limits silently weakened | Versioned policy bundle; protected code ownership; receipt records version/hash; approval invalidated by policy change | Policy-hash mismatch test |
| T14 | Nonce race and ambiguous retry | Duplicate or replaced transaction | **Open release gate:** current adapter queue is process-local. Add a durable per-signer journal, explicit nonce/hash reconciliation, and one-time authorization claim before enabling worker writes | Concurrent execution and restart tests pending |
| T15 | False confirmation from transaction hash or SDK misuse | UI/receipt lies | Require successful mined receipt; unified SDK receipt read from `order.info`; decode expected contract/fill; reconcile resulting position | Mined-revert and hash-only tests |
| T16 | Settlement mismatch or oracle confusion | Wrong claim/outcome | Bind oracle question/settlement reference; use finalized history plus on-chain state; surface oracle evidence; support `VOID`; do not infer from spot price | Settlement outcome fixtures and chain reconciliation |
| T17 | False redemption completion | Missing funds, dishonest evidence | Require successful redemption tx or verified already-redeemed chain balance/state; append linked receipt | Redemption failure test |
| T18 | Dependency compromise | Build/runtime compromise | Exact SDK and critical dependency pins; lockfile integrity; provenance/audit; minimize dependencies; inspect install scripts | Dependency audit and recorded SDK integrity |
| T19 | Gas depletion or native-token confusion | Failed execution/retry storm | Native SOMI balance preflight and reserve; missing read is unknown; cap retries and stop on deterministic revert | Zero/unknown gas tests |
| T20 | Book movement/front-running | Cost/slippage exceeds intent | Refresh book before sign; snapshot tolerance; max price and IOC; bound executable depth and impact; short order expiry | Changed-book invalidation test |
| T21 | Invisible resting remainder | Unintended open risk | IOC intentionally; verify order result and any open-order state | Partial-fill integration fixture |
| T22 | Worker crash between stages | Duplicate writes/incomplete audit | **Open release gate:** implement durable idempotency claim and append-only stage journal; reconcile chain before resume; graceful shutdown alone is insufficient | Kill/restart integration test pending |
| T23 | Fixture or replay presented as live | Misleading judges/users | Cryptographic fixture digest and provenance; persistent `fixture`/`verified-replay` label; real hashes only; no synthetic explorer links | E2E label assertions |
| T24 | Cross-site scripting in intent, market metadata, or receipt view | Wallet/user compromise | Render as text; sanitize downloads/links; CSP; no HTML interpretation; safe URL allowlist | XSS fixture tests |

## Critical security invariants

The release gate must prove:

- premium never exceeds the authorized budget after quantization;
- normalized size never exceeds executable depth;
- failed or unknown policy results cannot call the signer;
- a market change beyond tolerance invalidates authorization;
- receipt verification fails after any field changes;
- testnet-only configuration cannot resolve to mainnet;
- unknown balances never authorize execution or destructive state changes;
- confirmation requires a successful receipt and evidence;
- redemption completion requires a transaction or verified chain state;
- scenario charts and receipts share one hedge-calculation result;
- preview and pre-sign evaluation call the same policy implementation.

## Residual risks

- Binary payout has strike, window, oracle, and basis risk and can diverge from wallet P&L.
- A single RPC can give a coherent but false view. A second provider improves detection but cannot remove chain/oracle risk.
- IOC bounds resting risk but may produce partial or zero fills.
- Testnet liquidity and behavior may not represent mainnet.
- DreamDEX proxy implementations and venue parameters can change while stable addresses remain.
- SHA-256 receipts prove integrity and linkage, not that every included assertion is true; chain evidence and independent verification provide provenance.
- A compromised injected wallet can approve a malicious request despite correct application controls; exact authorization display remains essential.

## Incident response

On a suspected compromise: disable execution mode; stop the worker without deleting its journal; preserve logs and receipt digests; inspect pending nonces and on-chain allowances; revoke testnet allowances where safe; rotate the disposable key; compare local receipts with chain data; document the discrepancy without rewriting historical artifacts. Never expose a suspected key in a bug report.

Responsible disclosure instructions belong in `SECURITY.md`. Implementation boundaries are detailed in [Trust Boundaries](architecture/trust-boundaries.md).
