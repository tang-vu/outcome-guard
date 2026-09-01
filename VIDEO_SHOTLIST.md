# OutcomeGuard video shot list

Target runtime: **2:35**. Capture at 1080p or higher, 30 fps, with legible UI at normal playback speed. Record the desktop judge path; capture a separate 390 px mobile proof for the README or appendix rather than shrinking the main video.

## Asset gate

| Asset | Required source | Status |
| --- | --- | --- |
| Release candidate | Commit that passed `npm ci` and `npm run verify` | Current redemption-evidence release commit; record final hash after push |
| Public app URL | Healthy release deployment | `https://outcomeguard.tangvu.dev` |
| Live market proof | Shannon `50312`, explicit venue, fresh book and onchain status | Captured from the public app; final recording derives the current live plan |
| Passing authorization snapshot | All mandatory market/plan policies pass | Captured `READY TO SIGN`; human-signature and balance checks remain preflight-only |
| Execution proof | Successful mined IOC receipt, fill, reconciled position | Complete: `0xabc2…be99`, `4.171 NO` |
| Receipt proof | Immutable final JSON and digest, CLI verification | Complete through redemption digest `0xc272…8205` |
| Settlement proof | Independently verified terminal DreamDEX market | Owned market `…eec6`, block `476073320`, `NO / DOWN` |
| Redemption proof | Successful tx and post-state reconciliation | Complete: `0x7021…effc`, `4.171 tUSDC`, position `0` |
| Historical replay label | Persistent fallback treatment | Superseded in the main judge card by `VERIFIED OWNED LIFECYCLE` |
| Mobile proof | 390 px Playwright screenshot after responsive pass | Complete: `docs/demo/outcomeguard-mobile.png` |

## Capture order

Record in this order so external state is preserved before editing:

1. Explorer and RPC evidence for the transaction, fill, position, settlement, and redemption.
2. Raw receipt JSON and CLI verification, including one tampered copy.
3. Live market API/UI with mode, timestamp, block, venue, and chain visible.
4. Main browser journey.
5. Historical replay journey.
6. Clean opening and closing cards.
7. Mobile proof and still screenshots.

Never record a private key, seed phrase, complete environment file, wallet export, access token, browser-extension account list, or notification containing personal data.

## Timeline

| Time | Shot | Action and framing | Proof/caption required |
| --- | --- | --- | --- |
| 0:00–0:05 | Title | OutcomeGuard logo/hero; slow push in | `Shannon testnet prototype · chain 50312` |
| 0:05–0:12 | Problem | Hero copy plus exposure-to-protection line | `Portfolio-aware rolling protection` |
| 0:12–0:20 | Exposure | Select ETH and enter `$1,000` | `Manual demo exposure — not wallet-derived` |
| 0:20–0:30 | Intent | Set 1h, 2% adverse move, 15 tUSDC cap, 2% slippage, 75% target | Exact control values visible |
| 0:30–0:42 | Market | Show market ID, settlement reference, expiry, onchain status | `LIVE READ · Shannon 50312 · venue …a28c` |
| 0:42–0:50 | Book | Pan across bids/asks, spread, depth, freshness, block | Timestamp and source visible |
| 0:50–1:02 | Live-derived plan | Click `Derive live plan`; show the `LIVE MARKET` mode plus requested/executable shares and binding constraints | If live derivation fails, switch visibly to `DETERMINISTIC FIXTURE PLAN` and say the fixture does not consume the prior book |
| 1:02–1:12 | Scenarios | Before/after chart, premium-at-risk, protection ratio | Persistent basis-risk disclosure |
| 1:12–1:23 | Policy | Expand PASS and FAIL rows | `Unknown required inputs fail closed` |
| 1:23–1:30 | Honest refusal | Show captured spread failure or current blocker | `No signing path when policy fails` |
| 1:30–1:41 | Authorization | Exact market/order/cost/chain, then wallet confirmation | `LIVE EXECUTION` only if all prerequisites are real |
| 1:41–1:53 | Chain proof | Stage tracker, explorer receipt, fill, reconciled position | Full tx hash available via link; successful receipt visible |
| 1:53–2:02 | Receipt | Human view, raw JSON, digest | Stage and previous digest visible |
| 2:02–2:13 | Tamper | CLI valid result, then changed copy fails | `Original valid · changed copy invalid` |
| 2:13–2:23 | Lifecycle | Switch to owned `…eec6` lifecycle | IOC → `4.171 NO` → `DOWN` → claimable |
| 2:23–2:29 | Claim truth | Open redemption explorer link and receipt | `4.171 tUSDC redeemed · winning position 0` |
| 2:29–2:35 | Close | Exposure → protect → verify plus link card | Only verified public URLs |

## Conditional edit paths

### A. Full evidence path

Use the full path: execution, reconciliation, settlement and redemption all have verified artifacts. Preserve the `dedicated-test-agent` label; do not imply human-wallet authorization.

### B. No executable market

Keep the real policy refusal. Replace wallet and transaction shots with the `NOT_PERFORMED` evidence file and say that no transaction is claimed. This is an honest technical demo but does not satisfy the final submission requirement; record again after an eligible market and authorization exist.

### C. Endpoint outage

Show the outage/fail-closed response briefly, then enter `DETERMINISTIC FIXTURE`. Do not use explorer-like mock links or animate fake confirmation. A verified historical replay may still demonstrate settlement if its source evidence is intact.

## Editing and accessibility

- Burn in accurate captions and provide an `.srt` file.
- Use callouts only for facts visible in the artifact being shown.
- Keep PASS/WARN/FAIL distinguishable by text and icon, not color alone.
- Avoid rapid zooms, flashing transitions, decorative terminal noise, and folder-tree walkthroughs.
- Blur only irrelevant personal browser chrome; never blur evidence needed to validate a claim.
- Keep transaction, market, and receipt identifiers available long enough to pause and inspect.
- Use one sentence at the replay transition: “This is verified historical evidence, not the live order.”

## Post-export verification

- [x] Runtime is between 2:00 and 3:00.
- [x] Every `LIVE` label corresponds to real Shannon state.
- [x] Every fixture/replay label is persistent and legible.
- [x] Transaction and redemption links open to the exact shown hashes.
- [x] Receipt digest matches the committed JSON.
- [x] Tampered copy fails independently.
- [x] No secrets, personal data, fabricated metrics, or placeholder URLs appear.
- [x] Captions match narration and mode changes.
- [x] The final public URL and GitHub commit are healthy after upload.
