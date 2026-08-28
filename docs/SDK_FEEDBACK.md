# DreamDEX Event Contracts SDK and Documentation Feedback

Prepared for the Somnia × DreamDEX Event Contracts Hackathon on 2026-08-28.

This report separates observations verified in current official documentation/package metadata from integration evidence that OutcomeGuard will add later. It does not claim defects were reproduced locally unless explicitly marked “reproduced.”

## Environment reviewed

- `@somnia-chain/markets-sdk@0.28.1`, npm `latest`, published `2026-08-21T12:59:31.151Z`.
- Registry integrity: `sha512-CwrYT/kSKaCxYk9ehdOPxGggOrRepaJIEH9tTQINGn4iHIDmE7kMoP33Da0GS0MA4LIt57mRnOnru0NZnnCU7A==`.
- Somnia Shannon testnet, chain ID `50312`.
- [Event Contracts documentation](https://docs.dreamdex.io/developers/event-contracts) and [machine-readable documentation](https://docs.dreamdex.io/llms-full.txt), read on 2026-08-28.
- [Official bot kit](https://github.com/somnia-chain/dreamdex-bot-kit), read on 2026-08-28.

## What works well

1. One typed `SomniaMarkets` entry point covers discovery, books, watches, trading, positions, settlement actions, and React integration.
2. `listLiveBinaryMarkets` plus `getMarketOnchain` makes the indexer/on-chain trust split explicit.
3. Version 0.28.0 added venue-aware price snapping, addressing a subtle JavaScript float-to-18-decimal tick failure documented with a concrete example.
4. Writes await receipts and versions 0.23.0+ throw decoded revert errors, which makes false success easier to prevent.
5. Dynamic `getBinaryBookParams`, finalized-market discovery, and raw bigint trader methods provide the primitives needed for a policy-enforced agent.
6. Documentation clearly explains the four binary sides, the one-book/two-outcome relationship, rolling pool reuse, void behavior, and explicit redemption.
7. The package is public on npm and has an MIT license, enabling reproducible hackathon builds without private registry credentials.

## Recommended improvements

| Priority | Observation | Why it matters | Suggested change |
| --- | --- | --- | --- |
| High | Testnet Event Contracts use 6-decimal `tUSDC`, while hackathon/product language often says USDso | Builders can mislabel authorization cost or apply 18-decimal assumptions | Put a prominent environment matrix at the top of the Event Contracts landing page and expose normalized `collateral: {symbol,address,decimals}` on every market-facing result |
| High | Unified write receipts live in `result.info`, whereas raw trader methods return them directly | A natural `order.receipt` check silently fails and can lead to false confirmation | Add a top-level typed `receipt` and `txHash` to all unified write results, or provide `assertSuccessfulWrite(result)`; deprecate the asymmetric shape gradually |
| High | Correct execution requires multiple independently documented gates: venue, chain, on-chain Trading status, staleness, tick/lot/minimum, expiry, gas, and receipt status | Bots are likely to omit one safety check | Ship `preflightBinaryOrder` returning normalized params plus structured failures and a snapshot hash; require callers to pass that snapshot into the write |
| High | Package metadata points to `https://github.com/somnia-chain/somnia-markets`, which returned 404 to an unauthenticated reader on 2026-08-28 | Source review, changelog access, issue filing, and reproducible documentation are impeded | Publish the repository or change npm `repository`/`homepage` to an accessible source/docs URL and include a changelog in the package |
| Medium | Pool addresses are recycled while market IDs identify windows | Generic exchange integrators naturally cache by pool | Add a first-class `MarketRef` containing `marketId`, generation/expiry, pool, venue, and chain; warn or reject writes whose cached generation differs |
| Medium | `amountToPrecision` may floor a sub-lot amount to zero without throwing | A bot can submit or report a no-op | Return a discriminated normalization result with `normalized`, `wasRounded`, and `reason`, or offer strict helpers that reject zero |
| Medium | The raw trader requires callers to construct future nanosecond expiry | Millisecond/second/nanosecond mistakes are easy and hazardous | Export `expiryNsFromNow`, `clampExpiryToMarket`, and a branded `TimestampNs` type |
| Medium | Finalized markets disappear from the live exchange view and redemption begins from a separate history query | Lifecycle implementations can stop at execution | Add `listClaimablePositions(account, {venueId})` and a complete end-to-end settlement/redeem example to the top-level guide |
| Medium | The SDK README gives chain/indexer/WS/address values separately | Partial environment switching can mix testnet and mainnet | Export an immutable `SHANNON_MARKETS_CONFIG` bundle and validate that chain, indexer, WS, and addresses share one environment |
| Medium | Indexer reads correctly throw rather than return empty, but staleness provenance is not obvious in ordinary results | Policy engines need to distinguish fresh, stale, and unknown | Include `observedAt`, indexed block number/hash, and source on market/book/history snapshots |
| Low | Human-unit unified calls accept JavaScript numbers even though exact binary prices matter | 0.28.0 snapping fixes grid alignment but exact user authorization remains clearer with decimals | Accept decimal strings as a first-class unified input and return both requested and quantized exact values |
| Low | Oracle evidence is linked by a constructed question URL | Receipt builders need durable machine-verifiable provenance | Return a typed settlement-evidence URL and oracle question ID in finalized/position responses |

## Proposed safety API

An SDK-level preflight would reduce duplicated and inconsistent bot logic:

```ts
type BinaryOrderPreflight =
  | {
      ok: true;
      chainId: 50312 | 5031;
      marketId: `0x${string}`;
      pool: `0x${string}`;
      collateral: { address: `0x${string}`; symbol: string; decimals: number };
      normalized: {
        side: "BUY_YES" | "SELL_YES" | "BUY_NO" | "SELL_NO";
        price: bigint;
        quantity: bigint;
        expireTimestampNs: bigint;
      };
      marketBlock: bigint;
      snapshotDigest: `0x${string}`;
      warnings: string[];
    }
  | {
      ok: false;
      failures: Array<{
        code: string;
        observed?: unknown;
        expected?: unknown;
        source: "indexer" | "chain" | "caller";
      }>;
    };
```

This should not decide a user's risk policy. It should establish venue facts, exact normalization, and reproducible chain state so applications can apply their own policies safely.

## Documentation inconsistencies and uncertainties

- The Event Contract address guide says Shannon collateral is tUSDC with 6 decimals, while general DreamDEX and hackathon copy often refers to USDso. OutcomeGuard will trust live venue/token metadata and display the exact asset.
- The SDK npm metadata identifies a GitHub repository that was not publicly accessible during review. It is unclear whether this is temporary or intentionally private.
- The DoraHacks event page describes a `$5,000 USDso` pool, while its summary card renders `5,000 USD`. It publishes no placement split or payout schedule.
- The hackathon page prose gives dates without a timezone. Embedded page metadata gives the close as `2026-09-08T18:00:00.000Z`; OutcomeGuard uses an earlier internal release deadline.

## Evidence status

The items above are documentation and package-metadata review findings. OutcomeGuard should append measured integration evidence—SDK calls, market snapshots, successful/reverted transaction behavior, reconciliation, and redemption—only after running them on Shannon. No testnet transaction or SDK defect reproduction is asserted by this document yet.

Useful primary references:

- [npm package](https://www.npmjs.com/package/@somnia-chain/markets-sdk)
- [Event Contracts overview](https://docs.dreamdex.io/developers/event-contracts)
- [Recipes](https://docs.dreamdex.io/developers/event-contracts/recipes)
- [Gotchas](https://docs.dreamdex.io/developers/event-contracts/gotchas)
- [Market structure](https://docs.dreamdex.io/developers/event-contracts/market-structure)
- [Contracts and addresses](https://docs.dreamdex.io/developers/event-contracts/contracts-and-addresses)

