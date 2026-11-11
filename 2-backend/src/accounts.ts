// Names for well-known local accounts (admin, merchant, demo customers), so that the API and the
// terminal can show "Alice" instead of only "0x3C44...93BC".
import { getAddress } from "ethers";
import type { Chain } from "./chain.ts";
import { loadDemoConfig } from "./config.ts";

export interface KnownAccount {
  name: string;
  address: string;
}

export async function loadKnownAccounts(chain: Chain): Promise<KnownAccount[]> {
  const demo = await loadDemoConfig();
  // The local Hardhat node returns its 20 test accounts here.
  const nodeAccounts: string[] = await chain.provider.send("eth_accounts", []);

  const customers = demo.customers
    .filter((c) => nodeAccounts[c.accountIndex] !== undefined)
    .map((c) => ({ name: c.name, address: getAddress(nodeAccounts[c.accountIndex]) }));

  return [
    { name: "Admin", address: getAddress(chain.deployment.accounts.admin) },
    { name: "Merchant", address: getAddress(chain.deployment.accounts.merchant) },
    ...customers,
  ];
}

/** Returns a function that finds the name of an address, or null if it is unknown. */
export function nameLookup(accounts: KnownAccount[]): (address: string) => string | null {
  const names = new Map(accounts.map((a) => [a.address.toLowerCase(), a.name]));
  return (address) => names.get(address.toLowerCase()) ?? null;
}

/** "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" -> "0x3C44...93BC" */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
