# Notices and Attribution

OutcomeGuard is Copyright (c) 2026 OutcomeGuard contributors and is distributed under the repository's MIT License.

## DreamDEX bot kit review

The official [Somnia DreamDEX bot kit](https://github.com/somnia-chain/dreamdex-bot-kit) is MIT-licensed and was reviewed as technical reference material on 2026-08-28.

An inspection of `packages/dreamdex/src` on 2026-08-28 found **no source file copied or adapted from the bot kit**. The package is an independent TypeScript wrapper around the published Markets SDK. It implements documented venue behaviors—on-chain status gating, market-ID identity, exact tick/lot units, future nanosecond expiry, IOC execution, successful-receipt verification, serialized writes, finalized-market discovery, and explicit redemption—using OutcomeGuard-specific types and safety checks.

Those behaviors are protocol/API requirements described by the official documentation and bot kit, not copied expressive source. Consequently, there are currently no adapted bot-kit files requiring per-file attribution. If future work copies or modifies bot-kit code, update this section before merge with:

- the exact OutcomeGuard file;
- the exact upstream file and immutable commit URL;
- the nature and date of the modification;
- preserved copyright and MIT license text.

Do not describe OutcomeGuard as a fork or renamed bot kit.

## Somnia Markets SDK

OutcomeGuard depends on `@somnia-chain/markets-sdk@0.28.1`, distributed under the MIT License.

```text
MIT License

Copyright (c) 2026 DreamDEX S.A. (Panama).

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Package metadata: [npm registry](https://registry.npmjs.org/@somnia-chain/markets-sdk/0.28.1). The installed package's `LICENSE` is the authoritative bundled copy.

## Other dependencies

OutcomeGuard also uses open-source dependencies listed in `package.json` and `package-lock.json`, including viem, Next.js, React, TypeScript, Zod, Vitest, Playwright, ESLint, and fast-check. Their authors retain their respective copyrights and trademarks. The lockfile is the complete dependency inventory; this notice does not replace license files distributed with dependency packages.

DreamDEX, Somnia, and related names are trademarks of their respective owners. Their use identifies interoperability and hackathon context and does not imply endorsement beyond the published event.
