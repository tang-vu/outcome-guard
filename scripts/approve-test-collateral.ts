import { createPublicClient, createWalletClient, defineChain, formatUnits, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const TUSDC = "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E" as const;
const abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }
] as const;

const env = z.object({
  PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  APPROVAL_POOL: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  APPROVAL_AMOUNT: z.coerce.number().positive().max(100),
  RPC_URL: z.string().url().default("https://api.infra.testnet.somnia.network")
}).parse(process.env);

const chain = defineChain({
  id: 50312,
  name: "Somnia Shannon",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [env.RPC_URL] } },
  blockExplorers: { default: { name: "Shannon Explorer", url: "https://shannon-explorer.somnia.network" } },
  testnet: true
});

async function main(): Promise<void> {
  const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);
  const pool = env.APPROVAL_POOL as `0x${string}`;
  const transport = http(env.RPC_URL);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const [chainId, nativeBalance, decimals, symbol] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({ address: TUSDC, abi, functionName: "decimals" }),
    publicClient.readContract({ address: TUSDC, abi, functionName: "symbol" })
  ]);
  if (chainId !== 50312) throw new Error(`Refusing approval on chain ${chainId}`);
  if (nativeBalance === 0n) throw new Error("Worker has zero STT");
  if (decimals !== 6 || symbol !== "tUSDC") throw new Error(`Unexpected collateral metadata: ${symbol}/${decimals}`);
  const amount = parseUnits(env.APPROVAL_AMOUNT.toString(), decimals);
  const before = await publicClient.readContract({ address: TUSDC, abi, functionName: "allowance", args: [account.address, pool] });
  if (before === amount) {
    console.log(JSON.stringify({ status: "ALREADY_EXACT", account: account.address, token: TUSDC, pool, allowance: formatUnits(before, decimals) }));
    return;
  }
  const { request } = await publicClient.simulateContract({ account, address: TUSDC, abi, functionName: "approve", args: [pool, amount] });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`tUSDC approval reverted: ${hash}`);
  const after = await publicClient.readContract({ address: TUSDC, abi, functionName: "allowance", args: [account.address, pool] });
  if (after !== amount) throw new Error(`Exact allowance did not reconcile: ${after} != ${amount}`);
  console.log(JSON.stringify({ status: "CONFIRMED", account: account.address, token: TUSDC, pool, allowance: formatUnits(after, decimals), txHash: hash, blockNumber: receipt.blockNumber.toString(), explorerUrl: `https://shannon-explorer.somnia.network/tx/${hash}` }));
}

void main().then(() => process.exit(0)).catch((error) => {
  console.error(JSON.stringify({ status: "FAILED", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
