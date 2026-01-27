import { config as loadDotenv } from "dotenv";
import fs from "node:fs";
import path from "node:path";

const envPath: string = process.env.RESERVE_ENV_PATH ?? path.resolve(process.cwd(), ".env.reserve");
loadDotenv({ path: envPath, override: true });

type ReserveConfigInput = {
  readonly host: string;
  readonly port: number;
  readonly rpcUrl: string;
  readonly usdtContract: string;
  readonly treasuryAddress: string;
  readonly apiKey: string;
  readonly xprvPath: string;
  readonly gasWalletDerivationIndex: number;
  readonly gasTopupWei: bigint;
  readonly minGasWei: bigint;
  readonly fundConfirmations: number;
  readonly sweepConfirmations: number;
  readonly allowedIps: string[];
};

type ReserveConfigValues = ReserveConfigInput & {
  readonly xprv: string;
};

class ReserveConfig {
  readonly host: string;
  readonly port: number;
  readonly rpcUrl: string;
  readonly usdtContract: string;
  readonly treasuryAddress: string;
  readonly apiKey: string;
  readonly xprvPath: string;
  readonly xprv: string;
  readonly gasWalletDerivationIndex: number;
  readonly gasTopupWei: bigint;
  readonly minGasWei: bigint;
  readonly fundConfirmations: number;
  readonly sweepConfirmations: number;
  readonly allowedIps: string[];
  constructor(input: ReserveConfigValues) {
    this.host = input.host;
    this.port = input.port;
    this.rpcUrl = input.rpcUrl;
    this.usdtContract = input.usdtContract;
    this.treasuryAddress = input.treasuryAddress;
    this.apiKey = input.apiKey;
    this.xprvPath = input.xprvPath;
    this.xprv = input.xprv;
    this.gasWalletDerivationIndex = input.gasWalletDerivationIndex;
    this.gasTopupWei = input.gasTopupWei;
    this.minGasWei = input.minGasWei;
    this.fundConfirmations = input.fundConfirmations;
    this.sweepConfirmations = input.sweepConfirmations;
    this.allowedIps = input.allowedIps;
    if (!this.rpcUrl) {
      throw new Error("reserve rpc url is required");
    }
    if (!this.usdtContract) {
      throw new Error("reserve usdt contract is required");
    }
    if (!this.treasuryAddress) {
      throw new Error("reserve treasury address is required");
    }
    if (!this.apiKey) {
      throw new Error("reserve api key is required");
    }
    if (!this.xprv) {
      throw new Error("reserve xprv is required");
    }
    if (typeof this.gasWalletDerivationIndex !== "number" || this.gasWalletDerivationIndex < 0) {
      throw new Error("reserve gas wallet derivation index must be a non-negative number");
    }
  }
  static load(): ReserveConfig {
    const defaultXprvPath: string = path.resolve(process.cwd(), "keys/xprv.txt");
    const xprvPath: string = process.env.RESERVE_XPRV_PATH ?? defaultXprvPath;
    const xprv: string = readTextFile({ filePath: xprvPath });
    const allowedIpsStr: string = process.env.RESERVE_ALLOWED_IPS ?? "";
    const allowedIps: string[] = allowedIpsStr ? allowedIpsStr.split(",").map((ip) => ip.trim()).filter((ip) => ip.length > 0) : [];
    return new ReserveConfig({
      host: getEnvString("RESERVE_HOST", "127.0.0.1"),
      port: getEnvNumber("RESERVE_PORT", 4100),
      rpcUrl: requireEnv("RESERVE_RPC_URL"),
      usdtContract: requireEnv("RESERVE_USDT_CONTRACT"),
      treasuryAddress: requireEnv("RESERVE_TREASURY_ADDRESS"),
      apiKey: requireEnv("RESERVE_API_KEY"),
      xprvPath,
      gasWalletDerivationIndex: getEnvNumber("RESERVE_GAS_WALLET_DERIVATION_INDEX", 0),
      gasTopupWei: getEnvBigInt("RESERVE_GAS_TOPUP_WEI", 500000000000000n),
      minGasWei: getEnvBigInt("RESERVE_GAS_MIN_WEI", 200000000000000n),
      fundConfirmations: getEnvNumber("RESERVE_FUND_CONFIRMATIONS", 1),
      sweepConfirmations: getEnvNumber("RESERVE_SWEEP_CONFIRMATIONS", 1),
      xprv,
      allowedIps,
    });
  }
}

function requireEnv(name: string): string {
  const value: string | undefined = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getEnvString(name: string, defaultValue: string): string {
  const value: string | undefined = process.env[name];
  return value ?? defaultValue;
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value: string | undefined = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const parsed: number = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBigInt(name: string, defaultValue: bigint): bigint {
  const value: string | undefined = process.env[name];
  if (!value) {
    return defaultValue;
  }
  try {
    const parsed: bigint = BigInt(value);
    return parsed;
  } catch {
    return defaultValue;
  }
}

function readTextFile(input: { readonly filePath: string }): string {
  const value: string = fs.readFileSync(input.filePath, "utf8");
  return value.trim();
}

let cachedConfig: ReserveConfig | null = null;

export function getReserveConfig(): ReserveConfig {
  if (!cachedConfig) {
    cachedConfig = ReserveConfig.load();
  }
  return cachedConfig;
}
