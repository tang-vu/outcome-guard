# Full-history secret scan

Status: `PASS`

- Tool: Gitleaks 8.30.1
- Scope: all Git history reachable from the repository, not only the working tree
- Configuration: `.gitleaks.toml`
- Report: `docs/evidence/gitleaks-report.json`
- Latest verified run: `2026-09-01T09:10:58.9240610Z`, after repository visibility became public
- Result: 55 reachable release commits, approximately 1.19 MB scanned, no leaks found
- Independent binary provenance: official Gitleaks v8.30.1 Windows x64 release archive; SHA-256 matched the signed release checksum manifest (`d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e`)
- Allowlists: narrowly scoped public contract addresses only; rules are constrained by path plus field/value shape and do not allow generic private keys or API tokens

The post-publication scan initially classified the `token` field in `docs/evidence/redemption-campaign-eec6/allowance-cleanup.json` as a generic API key. Structural inspection confirmed that the value is a public 20-byte ERC-20 contract address. No broad suppression was added: the allowlist matches only that evidence path, the exact `token` key, and a 40-hex-character EVM address. The configured rerun exited zero. A fresh full-history run remains required after every pushed release batch and before a tagged submission release.
