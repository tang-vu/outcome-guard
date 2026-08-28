# Full-history secret scan

Status: `PASS`

- Tool: Gitleaks 8.30.1
- Scope: all Git history reachable from the repository, not only the working tree
- Configuration: `.gitleaks.toml`
- Report: `docs/evidence/gitleaks-report.json`
- Allowlist: one exact public ERC-6909 outcome-token address in `packages/dreamdex/src/fixtures.ts`; the rule is path- and value-specific and does not allow generic private keys or API tokens

The initial scan reported that public contract address as a generic API-key false positive. No broad rule suppression was added. Repeated configured reruns exit zero and leave an empty JSON report; the most recent documented pre-evidence run inspected 12 commits (approximately 851 KB) on 2026-08-28 at 18:09 UTC. A fresh full-history run is required after every pushed release batch and immediately before public visibility changes.
