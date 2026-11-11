// All settings of the backend in one place. Each one can be overridden with an environment variable.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** Port of the REST API. */
export const PORT = Number(process.env.PORT ?? 3001);

/** JSON-RPC address of the local blockchain (`npm run node` in 1-smart-contracts). */
export const RPC_URL = process.env.RPC_URL ?? "http://localhost:8545";

/** File written by the deploy script of Part 1: contract addresses + ABIs. */
export const DEPLOYMENT_FILE =
  process.env.DEPLOYMENT_FILE ??
  fileURLToPath(new URL("../../1-smart-contracts/deployments/localhost.json", import.meta.url));

const DEMO_FILE = fileURLToPath(new URL("../config/demo.json", import.meta.url));

export interface DemoCustomer {
  name: string;
  accountIndex: number; // index of the local Hardhat test account (0 = admin, 1 = merchant)
}

export type DemoStep =
  | { award: { to: string; amount: number; reason: string } }
  | { transfer: { from: string; to: string; amount: number } }
  | { redeem: { customer: string; rewardId: number } };

export interface DemoConfig {
  customers: DemoCustomer[];
  steps: DemoStep[];
}

/** Demo customers (names for local accounts) and the steps of the seed script. */
export async function loadDemoConfig(): Promise<DemoConfig> {
  return JSON.parse(await readFile(DEMO_FILE, "utf8"));
}
