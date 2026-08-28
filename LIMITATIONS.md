# Known Limitations

Snapshot date: 2026-08-28. These limitations describe the current repository, not planned capabilities.

## Product and integration

- The primary web judge flow defaults to an explicitly labeled deterministic fixture. Its `LIVE READ EVIDENCE` panel can select `Derive live plan`; the server then refetches that market ID and rebuilds the plan, policy, and receipt from Shannon. Live planning remains opt-in so endpoint failure does not collapse the demo.
- Live discovery evidence exists in `docs/evidence/market-snapshot.json`. The execution and settlement artifacts are intentionally marked `NOT_PERFORMED`; there is no claimed IOC, fill, reconciled position, settlement, or redemption transaction yet.
- The web authorization button obtains a message signature and verifies the recovered signer server-side. Its envelope includes a receipt nonce and deadline, but it is not typed EIP-712 authorization and does not submit or authorize a DreamDEX transaction.
- `packages/dreamdex` implements guarded live IOC placement, successful-receipt checking, position reads, finalized-market discovery, and redemption. Those methods have not yet been exercised with a funded Shannon signer in this repository's evidence.
- The agent is a serialized market observer with health diagnostics. It does not yet persist jobs, recompute hedge proposals, automatically reconcile submitted orders after restart, monitor a held position through settlement, or request rolling-hedge authorization.
- Exposure is entered manually. Wallet WETH/WBTC balance discovery and USD valuation are not implemented in the judge flow.
- Natural-language intent is represented in the UI, but there is no provider-neutral AI adapter yet. Structured controls remain the deterministic source of truth.
- No receipt-anchor contract is implemented or deployed. Receipt integrity is off-chain SHA-256 canonicalization.

## Financial model

- Binary Event Contracts are nonlinear protection, not a perfect hedge. Strike, window, oracle, liquidity, fill, and basis risk can make the Event Contract outcome differ from wallet P&L.
- Scenario analysis is deterministic and transparent but not a forecast, VaR model, or guarantee. It does not estimate the probability of each scenario.
- IOC orders can fill partially or not at all. Visible order-book depth can disappear before inclusion.
- The baseline selects a single eligible contract; it does not yet optimize across multiple 15-minute and 1-hour windows or minimize expected shortfall.
- Manual USD exposure can be stale or incorrect. The application does not currently verify cost basis, portfolio liabilities, derivatives, or cross-wallet positions.
- Fees are modeled from current venue assumptions; gas and future protocol changes may alter realized economics.

## Network and venue

- Only Somnia Shannon chain ID `50312` is supported. Mainnet writes are intentionally impossible.
- Shannon Event Contracts currently use 6-decimal tUSDC at `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E`. General DreamDEX and hackathon copy often says USDso; the UI and receipts must use live venue token metadata rather than silently treating them as identical.
- Testnet liquidity, uptime, prices, token value, and settlement behavior do not establish mainnet performance.
- DreamDEX core addresses are proxies and venue parameters are mutable. Stable proxy addresses do not guarantee stable implementations.
- The default RPC/indexer are external availability dependencies. The deterministic fallback preserves the demo but cannot execute or prove new live state.
- Current endpoint validation enforces URL schemes and rejects embedded credentials, but it does not yet fully block redirects, private/link-local DNS resolution, or arbitrary HTTPS hosts. Do not enable untrusted endpoint overrides in write mode.

## Receipts and evidence

- A valid digest proves that a receipt has not changed under the specified canonicalization. It does not prove every assertion in the receipt is true.
- Independent provenance requires chain receipts, decoded expected events, market state, and position reconciliation. Pre-execution evidence alone cannot prove execution.
- The receipt explorer serves evidence artifacts packaged with the deployment; it is not a decentralized or complete receipt index.
- Historical replay is only acceptable with real source hashes and provenance. The current repository does not yet include a verified settled replay package.
- Evidence was captured from a working tree and identifies its commit as `working-tree-uncommitted`. Release evidence must be regenerated from the exact public commit.

## Security and operations

- The code has not received an independent security audit.
- The built-in secret scanner checks tracked and unignored working-tree files, not the full Git history. A separate full-history scan is required before public release.
- The in-memory signer queue serializes writes within one process only. Multiple worker replicas or a process restart require a durable distributed nonce/idempotency design before write mode is safe.
- The worker has a health endpoint and graceful shutdown, but no durable database, alerting integration, dead-letter queue, or operator dashboard.
- The Dockerfile and hosted deployment have not yet been verified in the published evidence.
- Dependency audit results and Playwright release-gate results must be recorded from the final commit; their existence is not claimed here.

## Submission status

- No public deployment URL, public repository release, demo video URL, DoraHacks submission, real Shannon execution link, or redemption link is claimed.
- External actions still required are listed exactly in [BLOCKERS.md](BLOCKERS.md).
- The hackathon page does not publish a prize split, team-size limit, winner announcement date, or explicit repository-publicity clause. Its embedded close timestamp is `2026-09-08T18:00:00.000Z`; the project uses an earlier internal release target.
