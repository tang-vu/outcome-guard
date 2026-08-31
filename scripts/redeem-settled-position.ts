import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createShannonAdapter, DREAMDEX_SHANNON_VENUE, formatDecimal } from "@outcome-guard/dreamdex";
import { sealReceipt, verifyReceipt } from "@outcome-guard/receipt";
import { receiptCoreSchema } from "@outcome-guard/schemas";
import { parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const env = z.object({ PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).parse(process.env);

async function main(): Promise<void> {
  const settlementPath = resolve(process.argv[2] ?? "docs/evidence/settlement-receipt.json");
  const outputPath = resolve(process.argv[3] ?? "docs/evidence/redemption-receipt.json");
  const settlement = receiptCoreSchema.parse(JSON.parse(await readFile(settlementPath, "utf8")));
  if (!verifyReceipt(settlement).valid || settlement.lifecycleStage !== "SETTLEMENT" || !settlement.execution.position || !settlement.settlement?.outcome) throw new Error("a verified settlement receipt with position evidence is required");
  if (settlement.settlement.outcome === "VOID") throw new Error("void redemption requires a venue quote and is intentionally not inferred as a winner payout");
  const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);
  if (account.address.toLowerCase() !== settlement.execution.position.account.toLowerCase()) throw new Error("loaded signer does not own the settled position");
  const outcome = settlement.settlement.outcome === "UP" ? "YES" : "NO";
  if (outcome !== settlement.execution.position.filledOutcome) throw new Error("held outcome did not win; refusing a zero-payout redemption");
  const decimals = settlement.marketSnapshot.collateral.decimals;
  const amountRaw = parseUnits(settlement.settlement.claimable ?? "0", decimals);
  if (amountRaw <= 0n) throw new Error("settlement receipt has no positive claimable balance");

  const adapter = createShannonAdapter({ mode: "live", venueId: DREAMDEX_SHANNON_VENUE, privateKey: env.PRIVATE_KEY as `0x${string}` });
  try {
    const client = adapter.exchange?.client;
    if (!client) throw new Error("Shannon client is unavailable");
    const marketId = settlement.marketSnapshot.marketId as `0x${string}`;
    const onchain = await client.getMarketOnchain(marketId);
    if (onchain.status !== 4 || (onchain.winningOutcome === 0 ? "YES" : "NO") !== outcome) throw new Error("fresh on-chain terminal state does not reproduce the settlement receipt");
    const tokenId = outcome === "YES" ? onchain.yesId : onchain.noId;
    const [positionBefore, collateralBefore] = await Promise.all([
      client.getOutcomeBalance({ outcomeToken: onchain.outcomeToken, account: account.address, id: tokenId }),
      client.getErc20Balance(onchain.collateral, account.address),
    ]);
    if (positionBefore < amountRaw) throw new Error("fresh winning-token balance is below the sealed claimable amount");
    const result = await adapter.redeem(marketId, outcome, amountRaw);
    const [positionAfter, collateralAfter] = await Promise.all([
      client.getOutcomeBalance({ outcomeToken: onchain.outcomeToken, account: account.address, id: tokenId }),
      client.getErc20Balance(onchain.collateral, account.address),
    ]);
    if (positionBefore - positionAfter !== amountRaw) throw new Error("redemption receipt mined but winning-token burn did not reconcile");
    if (collateralAfter <= collateralBefore) throw new Error("redemption receipt mined but collateral did not increase");
    const receivedRaw = collateralAfter - collateralBefore;
    const { integrity: _integrity, receiptId: _receiptId, ...body } = settlement;
    void _integrity; void _receiptId;
    const redemption = sealReceipt({
      ...body,
      createdAt: new Date().toISOString(),
      lifecycleStage: "REDEMPTION",
      redemption: { txHash: result.txHash, amount: formatDecimal(receivedRaw, decimals), explorerUrl: result.explorerUrl },
      previousReceiptDigest: settlement.integrity.digest,
    });
    if (!verifyReceipt(redemption).valid) throw new Error("sealed redemption receipt failed independent verification");
    await writeFile(outputPath, `${JSON.stringify(redemption, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({ status: "REDEEMED", marketId, outcome, burned: formatDecimal(amountRaw, decimals), received: formatDecimal(receivedRaw, decimals), positionAfter: formatDecimal(positionAfter, decimals), txHash: result.txHash, explorerUrl: result.explorerUrl, redemptionReceiptDigest: redemption.integrity.digest, outputPath }, null, 2)}\n`);
  } finally {
    await Promise.race([adapter.close(), new Promise<void>((done) => setTimeout(done, 2_000))]);
  }
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
