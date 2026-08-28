#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { verifyExecutionBundle, verifyReceipt } from "./index.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run receipt:verify -- <receipt.json>");
  process.exitCode = 2;
} else {
  try {
    const value: unknown = JSON.parse(await readFile(file, "utf8"));
    const isBundle = Boolean(value && typeof value === "object" && (value as { schemaVersion?: unknown }).schemaVersion === "outcomeguard.execution-bundle.v1");
    const result = isBundle ? await verifyExecutionBundle(value, process.env.AGENT_SIGNER_ADDRESS ? { executionSigner: process.env.AGENT_SIGNER_ADDRESS } : {}) : verifyReceipt(value);
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
