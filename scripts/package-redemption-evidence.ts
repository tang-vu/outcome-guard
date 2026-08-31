import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyExecutionBundle, verifyReceipt } from "@outcome-guard/receipt";
import { executionBundleSchema, receiptCoreSchema } from "@outcome-guard/schemas";

async function main(): Promise<void> {
  const [bundleArg, executionArg, settlementArg, redemptionArg, outputArg] = process.argv.slice(2);
  if (!bundleArg || !executionArg || !settlementArg || !redemptionArg || !outputArg) throw new Error("Usage: package-redemption-evidence <bundle> <execution> <settlement> <redemption> <output-dir>");
  const [bundleRaw, executionRaw, settlementRaw, redemptionRaw] = await Promise.all([bundleArg, executionArg, settlementArg, redemptionArg].map((path) => readFile(resolve(path), "utf8")));
  const bundle = executionBundleSchema.parse(JSON.parse(bundleRaw));
  const execution = receiptCoreSchema.parse(JSON.parse(executionRaw));
  const settlement = receiptCoreSchema.parse(JSON.parse(settlementRaw));
  const redemption = receiptCoreSchema.parse(JSON.parse(redemptionRaw));
  const bundleCheck = await verifyExecutionBundle(bundle, { nowMs: Date.parse(bundle.authorizedReceipt.authorization.approvedAt!) });
  if (!bundleCheck.valid) throw new Error(`bundle verification failed: ${bundleCheck.errors.join("; ")}`);
  for (const [label, receipt] of [["execution", execution], ["settlement", settlement], ["redemption", redemption]] as const) {
    const check = verifyReceipt(receipt);
    if (!check.valid) throw new Error(`${label} receipt verification failed: ${check.errors.join("; ")}`);
  }
  if (execution.integrity.previousReceiptDigest !== bundle.authorizedReceipt.integrity.digest) throw new Error("execution receipt does not link to authorized receipt");
  if (settlement.integrity.previousReceiptDigest !== execution.integrity.digest) throw new Error("settlement receipt does not link to execution receipt");
  if (redemption.integrity.previousReceiptDigest !== settlement.integrity.digest) throw new Error("redemption receipt does not link to settlement receipt");
  if (redemption.lifecycleStage !== "REDEMPTION" || !redemption.redemption?.txHash || !redemption.settlement?.claimable) throw new Error("redemption lifecycle evidence is incomplete");

  const output = resolve(outputArg);
  await mkdir(output, { recursive: true });
  const artifact = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  const summary = {
    schemaVersion: "outcomeguard.redemption-evidence.v1",
    network: redemption.network,
    marketId: redemption.marketSnapshot.marketId,
    asset: redemption.marketSnapshot.asset,
    execution: { txHash: execution.execution.txHash, explorerUrl: execution.execution.explorerUrl, filledOutcome: execution.execution.position?.filledOutcome, filledSize: execution.execution.filledSize, collateralSpent: execution.execution.position?.collateralSpent, receiptDigest: execution.integrity.digest },
    settlement: { ...settlement.settlement, receiptDigest: settlement.integrity.digest },
    redemption: { ...redemption.redemption, receiptDigest: redemption.integrity.digest, positionAfter: "0" },
    authorization: { method: bundle.authorizedReceipt.authorization.method, signer: bundle.signer, mandateDigest: bundle.authorizedReceipt.authorization.mandateDigest },
    verification: { bundle: true, executionReceipt: true, settlementReceipt: true, redemptionReceipt: true, digestLinks: true },
  };
  await Promise.all([
    writeFile(resolve(output, "execution-bundle.json"), artifact(bundle), "utf8"),
    writeFile(resolve(output, "execution-receipt.json"), artifact(execution), "utf8"),
    writeFile(resolve(output, "settlement-receipt.json"), artifact(settlement), "utf8"),
    writeFile(resolve(output, "redemption-receipt.json"), artifact(redemption), "utf8"),
    writeFile(resolve(output, "summary.json"), artifact(summary), "utf8"),
  ]);
  process.stdout.write(artifact({ status: "PACKAGED", output, ...summary }));
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
