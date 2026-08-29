import { createPublicClient, createWalletClient, defineChain, formatUnits, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const TUSDC = "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E" as const;
const abi = [
  { type: "function", name: "faucet", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }
] as const;

const env = z.object({
  PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  FAUCET_AMOUNT: z.coerce.number().positive().max(100).default(100),
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
  const transport = http(env.RPC_URL);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const [chainId, nativeBalance, decimals, symbol, before] = await Promise.all([
    publicClient.getChainId(), publicClient.getBalance({ address: account.address }),
    publicClient.readContract({ address: TUSDC, abi, functionName: "decimals" }),
    publicClient.readContract({ address: TUSDC, abi, functionName: "symbol" }),
    publicClient.readContract({ address: TUSDC, abi, functionName: "balanceOf", args: [account.address] })
  ]);
  if (chainId !== 50312) throw new Error(`Refusing faucet call on chain ${chainId}`);
  if (decimals !== 6 || symbol !== "tUSDC") throw new Error(`Unexpected collateral metadata: ${symbol}/${decimals}`);
  if (nativeBalance === 0n) throw new Error("Worker has zero STT; fund the public address from an official Shannon faucet first.");
  const amount = parseUnits(env.FAUCET_AMOUNT.toString(), decimals);
  const { request } = await publicClient.simulateContract({ account, address: TUSDC, abi, functionName: "faucet", args: [amount] });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`tUSDC faucet transaction reverted: ${hash}`);
  const after = await publicClient.readContract({ address: TUSDC, abi, functionName: "balanceOf", args: [account.address] });
  if (after < before + amount) throw new Error("Confirmed faucet transaction did not produce the expected tUSDC balance increase.");
  console.log(JSON.stringify({ status: "CONFIRMED", account: account.address, token: TUSDC, amount: formatUnits(amount, decimals), balanceAfter: formatUnits(after, decimals), txHash: hash, blockNumber: receipt.blockNumber.toString(), explorerUrl: `https://shannon-explorer.somnia.network/tx/${hash}` }));
}

void main().catch((error) => { console.error(JSON.stringify({ status: "FAILED", error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; });
