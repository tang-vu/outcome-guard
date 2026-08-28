# Known Limitations

Snapshot date: 2026-08-29. These limitations describe the current repository, not planned capabilities.

## Product and integration

- The primary web judge flow defaults to an explicitly labeled deterministic fixture. Its `LIVE READ EVIDENCE` panel can select `Derive live plan`; the server then refetches that market ID and rebuilds the plan, policy, and receipt from Shannon. Live planning remains opt-in so endpoint failure does not collapse the demo.
- Live discovery evidence exists in `docs/evidence/market-snapshot.json`. The execution and settlement artifacts are intentionally marked `NOT_PERFORMED`; there is no claimed IOC, fill, reconciled position, settlement, or redemption transaction yet.
- With `AGENT_SIGNER_ADDRESS` configured, a live plan seals an exact raw-unit IOC proposal and the web signs a short-lived EIP-191 execution mandate containing its receipt, market snapshot, worker signer, price, quantity, premium and nanosecond expiry. The server recovers the human signer and returns a linked bundle. Signing does not submit; the explicit `execute-once` worker must independently verify and consume that file.
- `packages/dreamdex` implements guarded live IOC placement, successful-receipt checking, position reads, finalized-market discovery, and redemption. Those methods have not yet been exercised with a funded Shannon signer in this repository's evidence.
- The agent defaults to a serialized market observer. Its separate local-file-only `execute-once` command can consume one signed mandate with a durable claim, fresh policy pass and execution receipt, but has not been exercised with a funded signer. It deliberately does not auto-retry an ambiguous SDK submission; restart reconciliation, settlement monitoring and rolling proposals remain incomplete.
- Exposure is entered manually. Wallet WETH/WBTC balance discovery and USD valuation are not implemented in the judge flow.
- Natural-language intent uses a provider-neutral parser contract with a deterministic local fallback; provider output is accepted only after strict schema validation. No external or paid model provider is configured, and structured controls remain the deterministic source of truth.
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
- Current adapter endpoint validation enforces Shannon host allowlists, TLS schemes, default ports and no embedded credentials. Redirect and DNS-rebinding behavior has not been independently penetration-tested; do not add untrusted endpoint overrides in write mode.

## Receipts and evidence

- A valid digest proves that a receipt has not changed under the specified canonicalization. It does not prove every assertion in the receipt is true.
- Independent provenance requires chain receipts, decoded expected events, market state, and position reconciliation. Pre-execution evidence alone cannot prove execution.
- The receipt explorer serves evidence artifacts packaged with the deployment; it is not a decentralized or complete receipt index.
- The repository includes one chain-reconciled finalized market as a verified venue replay. It has no OutcomeGuard position, transaction, or redemption evidence and is labeled accordingly; it cannot satisfy Gate 5 ownership/redemption proof by itself.
- Live evidence was captured from clean source commit `351b014bfb9fa7ea6082fbdd47d10765a159925b`; the later evidence-packaging commit is intentionally distinct and does not rewrite the recorded source provenance.

## Security and operations

- The code has not received an independent third-party security audit.
- The built-in scanner covers tracked and unignored working-tree files. Gitleaks 8.30.1 full-history scans pass with one narrowly documented public-contract false-positive allowlist; the most recent run covered all 14 commits through `b39eb3e`. It must be rerun after every new release commit.
- The execution-coordinator is wired only to the explicit `execute-once` command for a single Linux-volume replica. It claims before submission and retains the signer lock after ambiguity, but the SDK path does not expose explicit nonce/raw-transaction persistence and automatic recovery. Multi-replica signing remains unsupported; this is testnet software, not production custody infrastructure.
- The worker has a health endpoint and graceful shutdown, but no durable database, alerting integration, dead-letter queue, or operator dashboard.
- The fixture agent image runs as non-root user `outcomeguard`, declares a persistent state volume, and reached Docker `healthy` locally with an isolated mount. It is not verified on a public host, and production volume durability/backup remain operator responsibilities.
- Dependency audit and Playwright results exist for the current checkpoint, but must be regenerated from the final release commit.

## Submission status

- No public deployment URL, public repository release, demo video URL, DoraHacks submission, real Shannon execution link, or redemption link is claimed.
- External actions still required are listed exactly in [BLOCKERS.md](BLOCKERS.md).
- The hackathon page does not publish a prize split, team-size limit, winner announcement date, or explicit repository-publicity clause. Its embedded close timestamp is `2026-09-08T18:00:00.000Z`; the project uses an earlier internal release target.
