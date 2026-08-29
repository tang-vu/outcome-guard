# External Action Blockers

Status: `NOT_PERFORMED`, last updated 2026-08-29. This file lists only actions that require a secret, wallet/faucet interaction, account authorization, waiting for external chain state, or an irreversible public-release decision. It is not evidence that any action occurred.

The repository currently has verified live Shannon read evidence but no claimed order, fill, reconciled position, settlement, redemption, public deployment, video, or DoraHacks submission.

## A. Real Shannon IOC and position reconciliation

Local preparation completed on 2026-08-29:

- A dedicated disposable Worker account was generated with a CSPRNG. Its public address is `0x1A3b41966bd8fFf0637685D5398762778FdeFfc2`.
- Its private key is stored only as Windows DPAPI ciphertext outside the repository at `%LOCALAPPDATA%\OutcomeGuard\secrets\worker-key.dpapi`, with an ACL limited to the current Windows user. The key was never printed or committed.
- `.env.local` binds the public `AGENT_SIGNER_ADDRESS`; secure PowerShell runners decrypt the key only into process memory and remove the environment value afterward.
- A direct Shannon read confirmed chain `50312` and a zero native STT balance. The collateral helper therefore failed closed before simulation or broadcast.

Remaining owner actions, in this order:

1. Use an official Shannon faucet at `https://testnet.somnia.network/` to send native STT to `0x1A3b41966bd8fFf0637685D5398762778FdeFfc2`. This web/CAPTCHA interaction cannot be completed autonomously. The required fact is a nonzero native balance on chain `50312`.
2. After STT is visible, engineering will run `scripts/fund-secure-worker.ps1`. It verifies chain, STT balance, tUSDC address/symbol/decimals, simulation, successful receipt and exact balance increase before accepting the collateral faucet result.
3. Add/select Somnia Shannon in an injected browser wallet used for human authorization: chain ID `50312`, official RPC `https://dream-rpc.somnia.network`, explorer `https://shannon-explorer.somnia.network`.
4. Review the fresh live preview showing chain `50312`, venue ID, market ID, dedicated execution signer, expiry, exact raw IOC quantity/price, maximum tUSDC premium, book-move tolerance, mandate digest and policy results. Sign that one EIP-191 mandate with the injected human-authorization wallet and download the verified bundle. A generic “go ahead” does not authorize a refreshed market.
5. Engineering will run `scripts/run-secure-worker.ps1` with the downloaded bundle. It supplies the absolute persistent state directory and uses zero initial premium-at-risk only while this new Worker has no prior trades. Never retry automatically after `AMBIGUOUS_SUBMISSION`; reconcile signer nonce and Shannon state first.

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

External state and owner action required:

1. Wait until the exact purchased market ID reaches on-chain `Resolved` or `Voided`. Indexer status alone is insufficient.
2. If the held outcome is winning, or the market is voided and the position is redeemable, review the exact market ID, outcome index, amount, collateral, chain, and expected claim; then explicitly sign the redemption transaction.
3. If the held outcome loses and has no payout, do not fabricate a claim or redeem completion. Record the losing terminal state honestly. To capture a redemption lifecycle, repeat a small authorized Shannon trade in another window and wait for a claimable result, or supply an independently verifiable historical Shannon position actually owned by the demo wallet.

Required proof before Gate 5 can be claimed:

- on-chain terminal status, winning outcome or void state, and oracle/settlement reference;
- pre-redemption outcome-token balance and claimable amount;
- successful redemption hash, receipt, block, and explorer URL, or verified already-redeemed chain state;
- post-redemption balance/state reconciliation;
- settlement and redemption receipts linked to the execution receipt digest.

## C. Vercel or equivalent public preview

Owner action required:

1. Authorize access to a Vercel or equivalent hosting account and choose the owning account/team.
2. Approve creation/linking of the project from this repository and the public preview URL. No wallet key is required or permitted in the web deployment.
3. Approve any custom domain or DNS change separately; it is not required for the hackathon preview.

Engineering can then apply the settings in `docs/DEPLOYMENT.md`, deploy the exact verified commit, test `/api/health`, `/api/markets`, desktop/mobile judge flow, and record the URL. A deployment URL must not be claimed before those health and release checks pass.

## D. Public repository release

Owner decision required:

1. After the full working-tree and Git-history secret scan is reviewed, explicitly approve changing repository visibility from private to public.
2. Approve pushing the final release commit/tag to the public remote.

This is intentionally last. Do not make the repository public while execution evidence, private logs, `.env` files, wallet artifacts, or video drafts remain under review.

## E. Demo video and publication

Owner action required:

1. Choose/authorize the recording and upload accounts.
2. During recording, approve any live Shannon wallet signature needed for the authorized-order segment. No seed phrase or private key should appear; crop wallet account details not needed as public evidence.
3. Review the final 2–3 minute cut and explicitly approve its public upload and URL.

The video must distinguish live discovery, live execution, deterministic fixture, and verified historical replay on screen. It must not claim settlement/redemption unless the evidence in section B exists.

## F. DoraHacks submission

Owner action required:

1. Sign in to DoraHacks, complete any profile/team/account requirements, and authorize the final submission.
2. Review and approve the public repository, deployment, and video links plus submission text before the irreversible final submit action.

Official embedded close time: `2026-09-08T18:00:00.000Z` (2026-09-09 01:00 in Asia/Saigon). OutcomeGuard's internal release target remains earlier and should not rely on timezone interpretation.
