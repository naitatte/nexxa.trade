import { Contract, HDNodeWallet, JsonRpcProvider, Wallet, getAddress, isAddress, type TransactionResponse, type ContractTransactionResponse, type HDNodeVoidWallet } from "ethers";
import { getReserveConfig } from "./config";

const erc20Abi: string[] = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
];

const MAX_DERIVATION_INDEX: number = 2147483647;
const MIN_SWEEP_AMOUNT: bigint = 1000000n;
const RPC_TIMEOUT_MS: number = 30000;

export type SweepRequest = {
  readonly paymentId: string;
  readonly derivationIndex: number;
  readonly fromAddress: string;
  readonly minUsdtUnits: bigint;
};

export type SweepResult = {
  readonly sweepTxHash: string;
  readonly fundingTxHash?: string;
  readonly sweptAt: string;
  readonly fundedAt?: string;
};

export class SweepError extends Error {
  readonly code: string;
  readonly paymentId: string;
  constructor(code: string, message: string, paymentId: string) {
    super(message);
    this.name = "SweepError";
    this.code = code;
    this.paymentId = paymentId;
  }
}

function validateSweepRequest(input: SweepRequest): void {
  if (!input.paymentId || typeof input.paymentId !== "string") {
    throw new SweepError("INVALID_PAYMENT_ID", "paymentId must be a non-empty string", input.paymentId ?? "unknown");
  }
  if (typeof input.derivationIndex !== "number" || !Number.isInteger(input.derivationIndex)) {
    throw new SweepError("INVALID_DERIVATION_INDEX", "derivationIndex must be an integer", input.paymentId);
  }
  if (input.derivationIndex < 0 || input.derivationIndex > MAX_DERIVATION_INDEX) {
    throw new SweepError("DERIVATION_INDEX_OUT_OF_RANGE", `derivationIndex must be between 0 and ${MAX_DERIVATION_INDEX}`, input.paymentId);
  }
  if (!input.fromAddress || !isAddress(input.fromAddress)) {
    throw new SweepError("INVALID_FROM_ADDRESS", "fromAddress must be a valid address", input.paymentId);
  }
  if (typeof input.minUsdtUnits !== "bigint" || input.minUsdtUnits < MIN_SWEEP_AMOUNT) {
    throw new SweepError("INVALID_MIN_USDT_UNITS", `minUsdtUnits must be at least ${MIN_SWEEP_AMOUNT}`, input.paymentId);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise: Promise<never> = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
}

export async function sweepUsdt(input: SweepRequest): Promise<SweepResult> {
  validateSweepRequest(input);
  const config: ReturnType<typeof getReserveConfig> = getReserveConfig();
  let provider: JsonRpcProvider;
  try {
    provider = new JsonRpcProvider(config.rpcUrl);
    await withTimeout(provider.getBlockNumber(), RPC_TIMEOUT_MS, "RPC connection check");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("RPC_CONNECTION_FAILED", `Failed to connect to RPC: ${errorMessage}`, input.paymentId);
  }
  let baseNode: HDNodeWallet | HDNodeVoidWallet;
  let derivedNode: HDNodeWallet | HDNodeVoidWallet;
  try {
    baseNode = HDNodeWallet.fromExtendedKey(config.xprv);
    derivedNode = baseNode.deriveChild(input.derivationIndex);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("KEY_DERIVATION_FAILED", `Failed to derive key: ${errorMessage}`, input.paymentId);
  }
  const expectedAddress: string = getAddress(input.fromAddress);
  const derivedAddress: string = getAddress(derivedNode.address);
  if (derivedAddress !== expectedAddress) {
    throw new SweepError("ADDRESS_MISMATCH", `Derived address ${derivedAddress} does not match expected ${expectedAddress}`, input.paymentId);
  }
  if (!("privateKey" in derivedNode)) {
    throw new SweepError("INVALID_KEY_TYPE", "xprv required for sweep operation", input.paymentId);
  }
  const signer: Wallet = new Wallet(derivedNode.privateKey, provider);
  const tokenContract: Contract = new Contract(getAddress(config.usdtContract), erc20Abi, signer);
  let tokenBalance: bigint;
  try {
    tokenBalance = await withTimeout(tokenContract.balanceOf(derivedAddress) as Promise<bigint>, RPC_TIMEOUT_MS, "Balance check");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("BALANCE_CHECK_FAILED", `Failed to check token balance: ${errorMessage}`, input.paymentId);
  }
  if (tokenBalance < input.minUsdtUnits) {
    throw new SweepError("INSUFFICIENT_BALANCE", `Token balance ${tokenBalance} is less than minimum ${input.minUsdtUnits}`, input.paymentId);
  }
  let gasWalletNode: HDNodeWallet | HDNodeVoidWallet;
  try {
    gasWalletNode = baseNode.deriveChild(config.gasWalletDerivationIndex);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("GAS_WALLET_DERIVATION_FAILED", `Failed to derive gas wallet: ${errorMessage}`, input.paymentId);
  }
  if (!("privateKey" in gasWalletNode)) {
    throw new SweepError("INVALID_GAS_WALLET_KEY_TYPE", "xprv required for gas wallet derivation", input.paymentId);
  }
  const gasWallet: Wallet = new Wallet(gasWalletNode.privateKey, provider);
  let gasResult: { fundingTxHash?: string; fundedAt?: string };
  try {
    gasResult = await ensureGas({
      provider,
      fromAddress: derivedAddress,
      gasWallet,
      minGasWei: config.minGasWei,
      topupWei: config.gasTopupWei,
      confirmations: config.fundConfirmations,
      paymentId: input.paymentId,
    });
  } catch (err: unknown) {
    if (err instanceof SweepError) {
      throw err;
    }
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("GAS_FUNDING_FAILED", `Failed to ensure gas funding: ${errorMessage}`, input.paymentId);
  }
  const treasuryAddress: string = getAddress(config.treasuryAddress);
  let sweepTx: ContractTransactionResponse;
  try {
    sweepTx = await withTimeout(tokenContract.transfer(treasuryAddress, tokenBalance) as Promise<ContractTransactionResponse>, RPC_TIMEOUT_MS, "Sweep transaction");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("SWEEP_TX_FAILED", `Failed to send sweep transaction: ${errorMessage}`, input.paymentId);
  }
  try {
    await withTimeout(sweepTx.wait(config.sweepConfirmations) as Promise<unknown>, RPC_TIMEOUT_MS * 3, "Sweep confirmation");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("SWEEP_CONFIRMATION_FAILED", `Sweep transaction sent (${sweepTx.hash}) but confirmation failed: ${errorMessage}`, input.paymentId);
  }
  const sweptAt: string = new Date().toISOString();
  return {
    sweepTxHash: sweepTx.hash,
    fundingTxHash: gasResult.fundingTxHash,
    fundedAt: gasResult.fundedAt,
    sweptAt,
  };
}

async function ensureGas(input: {
  readonly provider: JsonRpcProvider;
  readonly fromAddress: string;
  readonly gasWallet: Wallet;
  readonly minGasWei: bigint;
  readonly topupWei: bigint;
  readonly confirmations: number;
  readonly paymentId: string;
}): Promise<{ fundingTxHash?: string; fundedAt?: string }> {
  let balance: bigint;
  try {
    balance = await withTimeout(input.provider.getBalance(input.fromAddress), RPC_TIMEOUT_MS, "Gas balance check");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("GAS_BALANCE_CHECK_FAILED", `Failed to check gas balance: ${errorMessage}`, input.paymentId);
  }
  if (balance >= input.minGasWei) {
    return {};
  }
  let gasWalletBalance: bigint;
  try {
    gasWalletBalance = await withTimeout(input.provider.getBalance(input.gasWallet.address), RPC_TIMEOUT_MS, "Gas wallet balance check");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("GAS_WALLET_BALANCE_CHECK_FAILED", `Failed to check gas wallet balance: ${errorMessage}`, input.paymentId);
  }
  if (gasWalletBalance < input.topupWei) {
    throw new SweepError("GAS_WALLET_INSUFFICIENT", `Gas wallet has insufficient balance: ${gasWalletBalance} < ${input.topupWei}`, input.paymentId);
  }
  let tx: TransactionResponse;
  try {
    tx = await withTimeout(
      input.gasWallet.sendTransaction({
        to: input.fromAddress,
        value: input.topupWei,
      }),
      RPC_TIMEOUT_MS,
      "Gas funding transaction"
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("GAS_FUNDING_TX_FAILED", `Failed to send gas funding transaction: ${errorMessage}`, input.paymentId);
  }
  try {
    await withTimeout(tx.wait(input.confirmations) as Promise<unknown>, RPC_TIMEOUT_MS * 2, "Gas funding confirmation");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    throw new SweepError("GAS_FUNDING_CONFIRMATION_FAILED", `Gas funding transaction sent (${tx.hash}) but confirmation failed: ${errorMessage}`, input.paymentId);
  }
  const fundedAt: string = new Date().toISOString();
  return { fundingTxHash: tx.hash, fundedAt };
}
