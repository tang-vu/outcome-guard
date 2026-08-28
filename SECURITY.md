# Security Policy

OutcomeGuard is experimental Somnia Shannon testnet software. It is not audited, not financial advice, and must not be used with mainnet funds or a primary wallet.

## Supported version

Security fixes apply to the latest commit on the default branch. No released production version is currently supported. The only authorized execution network is Somnia Shannon, chain ID `50312`.

## Reporting a vulnerability

Do not open a public issue for a vulnerability, suspected secret, exploitable transaction path, or unpublished wallet address.

Use GitHub's private vulnerability reporting or security-advisory feature for this repository. If that feature is unavailable, contact the repository owner through a private channel listed on their GitHub profile and request a secure reporting channel before sending details. There is no bug-bounty or reward commitment.

Include:

- affected commit and component;
- impact and required attacker capabilities;
- minimal reproduction using fixtures or Shannon only;
- whether a transaction was sent, with its public testnet hash;
- suggested remediation, if known.

Never include private keys, seed phrases, access tokens, raw authorization headers, or secrets in a report. Allow reasonable time for triage and remediation before public disclosure.

## Security boundaries

- Shannon chain ID `50312` is enforced in configuration, policy, adapter, signer, and receipt layers. Mainnet chain ID `5031` is rejected.
- The browser uses an injected wallet. A worker key, when explicitly enabled, must be a disposable Shannon-only key supplied at runtime.
- DreamDEX indexer data is used for discovery, venue metadata, and history. Writes require an explicit allowed venue plus fresh direct on-chain status, market generation, book parameters, balance, gas, and receipt checks. Venue membership remains indexer-derived and is disclosed as a trust limitation.
- Prices and quantities use exact integer units. Collateral decimals are read directly from ERC-20 metadata and must agree with market metadata; tick size, lot size, and minimum quantity are read from the venue.
- Preview and pre-sign checks must use the same deterministic policy implementation. A live UI challenge binds an exact raw IOC mandate to a human EIP-191 signature, but the crash-safe worker transaction coordinator remains an open release gate.
- A transaction hash is not confirmation. Confirmation requires a successful mined receipt and on-chain position reconciliation.
- Lifecycle records are append-only canonical receipts linked by digest. Changed fields fail verification.
- Fixtures and historical replay must remain visibly labeled and cannot contain fabricated transaction links.

See [THREAT_MODEL.md](docs/THREAT_MODEL.md) and [trust-boundaries.md](docs/architecture/trust-boundaries.md) for the full model.

## Key handling

1. Never use a personal, treasury, or mainnet-funded wallet.
2. Prefer an injected wallet for interactive execution. If a worker signer is necessary, create a dedicated disposable Shannon account with only the required test assets.
3. Put secrets only in the local process environment or the deployment provider's encrypted secret store. Do not paste a key into source, chat, issue, receipt, evidence, screenshot, video, CI log, or Vercel public variable.
4. Never prefix a secret variable with `NEXT_PUBLIC_`.
5. Stop execution and rotate the disposable key if it may have appeared in terminal history, logs, clipboard tooling, screen recordings, or repository history.
6. Keep a native gas reserve and bound token approvals to the verified spender and required amount where the venue permits.

## Secret scanning

The repository command scans tracked and unignored working-tree text:

```bash
npm run secrets:scan
```

Before public release, also scan every reachable commit. One suitable command with Gitleaks installed is:

```bash
gitleaks git --redact --log-opts="--all"
```

Inspect the scanner version and output in the release evidence. The built-in scanner is not a substitute for history scanning. If a real secret is found, revoke or rotate it first; deleting the text does not make the credential safe.

## Dependency security

Critical dependencies are exact-pinned in `package-lock.json`. DreamDEX integration uses `@somnia-chain/markets-sdk@0.28.1`; its registry integrity and license are recorded in [SDK_FEEDBACK.md](docs/SDK_FEEDBACK.md) and [NOTICE.md](NOTICE.md).

Run:

```bash
npm ci
npm run audit:deps
npm run verify
```

An audit exception must identify the advisory, affected path, actual reachability, compensating controls, owner, and expiry. Do not suppress an advisory only to make the release gate green.

## Deployment security

- Public web deployments contain public endpoints and public network metadata only.
- The read-only web service must not receive `PRIVATE_KEY`.
- Worker writes default to `DRY_RUN=true` and fixtures default to enabled.
- Production endpoint overrides must be HTTPS/WSS, credential-free, allowlisted, and protected against localhost/private/link-local resolution before write mode is enabled.
- Health endpoints expose mode, chain, and readiness, never secrets, balances, signatures, full errors containing credentials, or private operational data.
- Set security headers at the hosting edge, including a restrictive Content Security Policy, clickjacking protection, MIME sniffing protection, and a conservative referrer policy.

## Incident response

Disable write mode, stop the worker gracefully, preserve append-only receipts and logs, inspect pending Shannon nonces and allowances, rotate the disposable key, and reconcile every claimed stage against chain state. Do not rewrite evidence to hide an incident. Record false or incomplete claims as corrected linked artifacts.
