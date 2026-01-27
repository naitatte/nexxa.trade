import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env";

type PaymentsConfigInput = {
  readonly chain: string;
  readonly rpcUrl: string;
  readonly usdtContract: string;
  readonly confirmations: number;
  readonly scanBatch: number;
  readonly scanChunk: number;
  readonly scanIntervalSeconds: number;
  readonly reserveUrl: string;
  readonly reserveApiKey: string;
  readonly treasuryAddress: string;
  readonly xpubPath: string;
};

type PaymentsConfigValues = PaymentsConfigInput & {
  readonly xpub: string;
};

class PaymentsConfig {
  readonly chain: string;
  readonly rpcUrl: string;
  readonly usdtContract: string;
  readonly confirmations: number;
  readonly scanBatch: number;
  readonly scanChunk: number;
  readonly scanIntervalSeconds: number;
  readonly reserveUrl: string;
  readonly reserveApiKey: string;
  readonly treasuryAddress: string;
  readonly xpubPath: string;
  readonly xpub: string;
  constructor(input: PaymentsConfigValues) {
    this.chain = input.chain;
    this.rpcUrl = input.rpcUrl;
    this.usdtContract = input.usdtContract;
    this.confirmations = input.confirmations;
    this.scanBatch = input.scanBatch;
    this.scanChunk = input.scanChunk;
    this.scanIntervalSeconds = input.scanIntervalSeconds;
    this.reserveUrl = input.reserveUrl;
    this.reserveApiKey = input.reserveApiKey;
    this.treasuryAddress = input.treasuryAddress;
    this.xpubPath = input.xpubPath;
    this.xpub = input.xpub;
    if (!this.chain) {
      throw new Error("payments chain is required");
    }
    if (!this.rpcUrl) {
      throw new Error("payments rpc url is required");
    }
    if (!this.usdtContract) {
      throw new Error("payments usdt contract is required");
    }
    if (!this.reserveUrl) {
      throw new Error("payments reserve url is required");
    }
    if (!this.reserveApiKey) {
      throw new Error("payments reserve api key is required");
    }
    if (!this.treasuryAddress) {
      throw new Error("payments treasury address is required");
    }
    if (!this.xpub) {
      throw new Error("payments xpub is required");
    }
  }
  static load(): PaymentsConfig {
    const xpubPath: string = env.PAYMENTS_XPUB_PATH || path.resolve(process.cwd(), "keys/xpub.txt");
    const xpub: string = readTextFile({ filePath: xpubPath });
    return new PaymentsConfig({
      chain: env.PAYMENTS_CHAIN,
      rpcUrl: env.PAYMENTS_RPC_URL,
      usdtContract: env.PAYMENTS_USDT_CONTRACT,
      confirmations: env.PAYMENTS_CONFIRMATIONS,
      scanBatch: env.PAYMENTS_SCAN_BATCH,
      scanChunk: env.PAYMENTS_SCAN_CHUNK,
      scanIntervalSeconds: env.PAYMENTS_SCAN_INTERVAL_SECONDS,
      reserveUrl: env.PAYMENTS_RESERVE_URL,
      reserveApiKey: env.PAYMENTS_RESERVE_API_KEY,
      treasuryAddress: env.PAYMENTS_TREASURY_ADDRESS,
      xpubPath,
      xpub,
    });
  }
}

function readTextFile(input: { readonly filePath: string }): string {
  const value: string = fs.readFileSync(input.filePath, "utf8");
  return value.trim();
}

let cachedConfig: PaymentsConfig | null = null;

export function getPaymentsConfig(): PaymentsConfig {
  if (!cachedConfig) {
    cachedConfig = PaymentsConfig.load();
  }
  return cachedConfig;
}
