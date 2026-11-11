import type { Account } from "./api";

/** "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" -> "0x3C44...93BC" */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** "Alice (0x3C44...93BC)" for known accounts, otherwise only the short address. */
export function displayAddress(address: string, accounts: Account[]): string {
  const known = accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
  return known?.name ? `${known.name} (${shortAddress(address)})` : shortAddress(address);
}

export function formatTime(unixSeconds: number): string {
  return unixSeconds ? new Date(unixSeconds * 1000).toLocaleString() : "-";
}
