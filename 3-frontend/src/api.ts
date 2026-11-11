// Calls to the backend (Part 2). The Vite server forwards /api to http://localhost:3001.
// The backend is only used for READING. Transactions go from MetaMask directly to the blockchain.
import type { InterfaceAbi } from "ethers";

export interface Deployment {
  network: string;
  chainId: number;
  deployedAt: string;
  accounts: { admin: string; merchant: string };
  contracts: {
    LoyaltyToken: { address: string; abi: InterfaceAbi };
    LoyaltyProgram: { address: string; abi: InterfaceAbi };
  };
  token: { name: string; symbol: string };
}

export interface Reward {
  id: number;
  name: string;
  cost: number;
  stock: number;
  active: boolean;
}

export interface Account {
  address: string;
  name: string | null;
  balance: number;
  isAdmin: boolean;
  isMerchant: boolean;
}

export type ActivityType = "award" | "transfer" | "redeem" | "mint" | "burn";

export interface Activity {
  type: ActivityType;
  from: string | null;
  to: string | null;
  amount: number;
  details: string;
  merchant?: string;
  rewardId?: number;
  redemptionId?: number;
  blockNumber: number;
  logIndex: number;
  timestamp: number;
  txHash: string;
}

export interface Stats {
  token: { name: string; symbol: string; address: string };
  totalSupply: number;
  totalIssued: number;
  totalRedeemed: number;
  totalBurned: number;
  totalTransferred: number;
  transactionCount: number;
  countByType: Record<ActivityType, number>;
  holderCount: number;
  redemptionCount: number;
  blockNumber: number;
}

export interface Holder {
  address: string;
  name: string | null;
  balance: number;
}

const BACKEND_DOWN = 'Backend is not reachable. Start it with "npm start" in 2-backend.';

async function get<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`);
  } catch {
    throw new Error(BACKEND_DOWN);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `${BACKEND_DOWN} (HTTP ${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  deployment: () => get<Deployment>("/deployment"),
  stats: () => get<Stats>("/stats"),
  rewards: () => get<Reward[]>("/rewards"),
  accounts: () => get<Account[]>("/accounts"),
  account: (address: string) => get<Account>(`/accounts/${address}`),
  holders: () => get<Holder[]>("/holders"),
  transactions: (options: { address?: string; type?: ActivityType; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.type) params.set("type", options.type);
    if (options.limit) params.set("limit", String(options.limit));
    const query = params.size > 0 ? `?${params}` : "";
    const path = options.address ? `/transactions/${options.address}` : "/transactions";
    return get<Activity[]>(path + query);
  },
};
