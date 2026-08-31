# Evidence limitations

- `market-snapshot.json` is a genuine Shannon read. The main composer screenshot uses a deterministic fixture for demo reliability.
- The original live capture failed closed because signer-dependent premium risk, gas balance, and authorization were unknown; a later, separately evidenced dedicated-test-agent run passed those checks.
- `execution-receipt.json` and `settlement-receipt.json` are verified lifecycle receipts linked by digest. The run settled against the held outcome, so claimable is zero.
- Real transaction hashes, fills, reconciled positions, losing and winning settlements, a successful redemption, and deployment URL are present. No private key, human-wallet execution, or video is claimed.
- The working-tree scanner is not a substitute for the required full-history scan immediately before public release.
- Binary Event Contracts create nonlinear basis risk and do not perfectly hedge spot exposure.
