# External Action Blockers

Status: `PARTIALLY RESOLVED`, last updated 2026-08-31. This file lists only actions that require a secret, wallet/faucet interaction, account authorization, waiting for external chain state, or an irreversible public-release decision.

The repository now has real mined, filled and position-reconciled Shannon IOCs plus both losing and winning settlement branches. The winning branch was redeemed and reconciled to zero. Human-wallet execution, video publication, repository visibility and DoraHacks submission remain incomplete.

## A. Real Shannon IOC and position reconciliation

Local preparation completed on 2026-08-29:

- A dedicated disposable Worker account was generated with a CSPRNG. Its public address is `0x1A3b41966bd8fFf0637685D5398762778FdeFfc2`.
- Its private key is stored only as Windows DPAPI ciphertext outside the repository at `%LOCALAPPDATA%\OutcomeGuard\secrets\worker-key.dpapi`, with an ACL limited to the current Windows user. The key was never printed or committed.
- `.env.local` binds the public `AGENT_SIGNER_ADDRESS`; secure PowerShell runners decrypt the key only into process memory and remove the environment value afterward.
- Native STT funding is present. The guarded faucet helper minted and reconciled the worker balance to `200 tUSDC` in transaction `0x3d2e8b0188a7f58c7861ca850a415d70b14dac5e70f0e267dfcc9adb01a7112d`.
- An exact `15 tUSDC` allowance for the current one-hour pool was confirmed in transaction `0x2eb211d6f5861abe1702532446d78fbd586ed1390a269c87ee5d899633cbebec`; unlimited approval is not used.

Remaining owner actions, in this order:

1. Add/select Somnia Shannon in the injected human-authorization wallet: chain ID `50312`, official RPC `https://dream-rpc.somnia.network`, explorer `https://shannon-explorer.somnia.network`.
4. Review the fresh live preview showing chain `50312`, venue ID, market ID, dedicated execution signer, expiry, exact raw IOC quantity/price, maximum tUSDC premium, book-move tolerance, mandate digest and policy results. Sign that one EIP-191 mandate with the injected human-authorization wallet and download the verified bundle. A generic “go ahead” does not authorize a refreshed market.
3. If the selected market uses a different pool, engineering must first run `scripts/approve-secure-worker.ps1` for that exact pool and bounded amount. The PM2 worker otherwise receives the verified bundle automatically. Never retry after `AMBIGUOUS_SUBMISSION`; reconcile signer nonce and Shannon state first.

After those actions, the engineering workflow must re-run the same policy engine immediately before signing, submit exactly one bounded IOC, require a successful mined receipt, decode fills, read the outcome-token position from chain, and write linked evidence. If the book moves or a policy fails, authorization expires and a new preview/signature is required.

Required proof before Gate 4 can be claimed:

- real Shannon transaction hash and explorer URL;
- successful receipt status and block number;
- requested versus filled quantity and average fill price;
- actual premium bounded by the authorized maximum;
- direct on-chain YES/NO position read for the signer;
- linked execution receipt digest;
- no claim that a zero-fill or reverted transaction succeeded.

## B. Settlement and redemption

Resolved on 31 August 2026. Market `…eec6` resolved `DOWN` while the worker held `4.171 NO`; redemption returned `4.171 tUSDC` and burned the winning-token position to zero. Evidence is packaged in `docs/evidence/redemption-campaign-eec6`.

No owner action remains for the dedicated-test-agent settlement/redemption branch. A future human-wallet redemption would require its own explicit wallet confirmation.

Evidence status for Gate 5:

- on-chain terminal status, winning outcome, position balance, and positive claimable amount are proven in `docs/evidence/redemption-campaign-eec6`;
- the linked settlement receipt is proven and independently verifiable;
- successful redemption hash, receipt and explorer URL are committed;
- winning-token burn and collateral increase are reconciled;
- redemption receipt `0xc272e960d137b04b34dd25be22d411e084e3904d0c7c43ec583902ae72ce8205` links to settlement receipt `0xba81ed0240fd570e369ba96ddf5488846407f6430eda046fc84be28268d18150`.

## C. Public preview — resolved

No owner action remains for preview hosting. `https://outcomeguard.tangvu.dev` is routed through a named Cloudflare Tunnel to the loopback-only OutcomeGuard production process. Local and public health checks, security headers, tunnel connections, PM2 supervision, and post-reboot logon restore configuration are recorded in `docs/evidence/deployment.json`.

## D. Public repository release

Owner decision required:

1. After the full working-tree and Git-history secret scan is reviewed, explicitly approve changing repository visibility from private to public.
2. Approve pushing the final release commit/tag to the public remote.

This is intentionally last. Do not make the repository public while execution evidence, private logs, `.env` files, wallet artifacts, or video drafts remain under review.

## E. Demo video and publication

Owner action required:

1. Revoke the MiMo key that was pasted into chat on 2026-08-31. Treat it as compromised even if it still works.
2. Create a replacement Token Plan key, then enter it only through the hidden local prompt—never through chat, source code, `.env`, or a shell command argument:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo/setup-mimo-key.ps1
   ```

   This stores Windows DPAPI ciphertext outside the repository with a current-user-only ACL. After that, engineering can run `npm run demo:audio`, review the MiMo V2.5 ASR back-check, and render the final cut without seeing or logging plaintext.
3. Review the final 2–3 minute cut and explicitly approve its public upload and URL.

The 1080p evidence capture, 2:35 English narration timeline, subtitles, MiMo TTS/ASR integration, and reproducible FFmpeg render pipeline are complete. A new live wallet signature is not required: the recording uses the already-verified dedicated-test-agent execution and redemption lifecycle, with its evidence boundary shown on screen.

## F. DoraHacks submission

Owner action required:

1. Sign in to DoraHacks, complete any profile/team/account requirements, and authorize the final submission.
2. Review and approve the public repository, deployment, and video links plus submission text before the irreversible final submit action.

Official embedded close time: `2026-09-08T18:00:00.000Z` (2026-09-09 01:00 in Asia/Saigon). OutcomeGuard's internal release target remains earlier and should not rely on timezone interpretation.
