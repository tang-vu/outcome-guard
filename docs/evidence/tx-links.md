# Transaction links

Updated: 2026-08-31.

OutcomeGuard completed one dedicated-test-agent Shannon E2E on 31 August 2026. It is real execution evidence but is not represented as a human wallet authorization.

Setup transactions are recorded separately and are not presented as hedge execution:

- tUSDC faucet: [`0x3d2e…112d`](https://shannon-explorer.somnia.network/tx/0x3d2e8b0188a7f58c7861ca850a415d70b14dac5e70f0e267dfcc9adb01a7112d), block `475846325`; worker balance reconciled to `200 tUSDC`.
- Exact `15 tUSDC` allowance for pool `0x90dB0C4C4A25096103faeD8a3C7178C190abAE20`: [`0x2eb2…bec`](https://shannon-explorer.somnia.network/tx/0x2eb211d6f5861abe1702532446d78fbd586ed1390a269c87ee5d899633cbebec), block `475847601`.
- Dedicated E2E pool approval: [`0xfb38…b44d`](https://shannon-explorer.somnia.network/tx/0xfb38427ca2fd4fee1972d6083d03de61e3bcf9d82c48298f0484c235e18fb44d).
- Bounded IOC and full fill: [`0xbe1b…03be`](https://shannon-explorer.somnia.network/tx/0xbe1b148423553b21f7c4177248dc6be19406e1416b1f065cc556279de4da03be), block `475857493`; `29.182` NO requested and filled at average `0.486`, with `14.182452 tUSDC` spent and the position reconciled from `0` to `29.182` NO.

- Network: Somnia Shannon, chain `50312`
- Explorer: <https://shannon-explorer.somnia.network>
- Live read market ID: `0x000000000000000000000000000000000000000000000000000000000000ea15`
- Evidence source commit: `fe408abba6a3db9321f0912e1998442122c0f321` (clean tree at capture)
- Execution: `RECONCILED` in explicitly labeled `dedicated-test-agent` mode; receipt digest `0x2cdeed07d710ace2360624c29989bca315260bf25eb03ca803e6ce90db304d79`
- Settlement: market `0x…ea9a` was read directly at Shannon block `475953729` as on-chain `Resolved` / code `4`, finalized, winning `YES / UP`. The reconciled `29.182 NO` position therefore has `0 tUSDC` claimable. Settlement receipt: `0x403e08fa79d0e0374f54886b79f00b4e6c52e90a2915b0904625ac244916537d`.
- Redemption: `NOT_APPLICABLE` for this position because claimable is exactly zero; OutcomeGuard does not submit a zero-payout redemption.

See [`../../BLOCKERS.md`](../../BLOCKERS.md) for the exact minimal wallet actions and required evidence.
