// Reads the events of both contracts and turns them into one readable transaction history.
// Nothing is stored in a database: every request reads the data directly from the blockchain.
import { EventLog, ZeroAddress } from "ethers";
import type { Log } from "ethers";
import type { Chain } from "./chain.ts";

export const ACTIVITY_TYPES = ["award", "transfer", "redeem", "mint", "burn"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** One entry of the transaction history. */
export interface Activity {
  type: ActivityType;
  from: string | null; // null when tokens are created (award, mint)
  to: string | null; // null when tokens are destroyed (redeem, burn)
  amount: number;
  details: string; // award reason or reward name
  merchant?: string; // award only
  rewardId?: number; // redeem only
  redemptionId?: number; // redeem only
  blockNumber: number;
  logIndex: number; // position of the event inside the block
  timestamp: number; // unix time in seconds
  txHash: string;
}

// Plain versions of the three events we need (no ethers objects, easy to test).
export interface EventInfo {
  blockNumber: number;
  blockHash: string;
  txHash: string;
  logIndex: number;
}
export interface TransferEvent extends EventInfo {
  from: string;
  to: string;
  amount: number;
}
export interface AwardEvent extends EventInfo {
  customer: string;
  amount: number;
  reason: string;
  merchant: string;
}
export interface RedeemEvent extends EventInfo {
  redemptionId: number;
  customer: string;
  rewardId: number;
  cost: number;
}
export interface RawEvents {
  transfers: TransferEvent[];
  awards: AwardEvent[];
  redemptions: RedeemEvent[];
}

/** Reads all Transfer, TokensAwarded and RewardRedeemed events (from block 0; fine for a local chain). */
export async function fetchEvents(chain: Chain): Promise<RawEvents> {
  const { token, program } = chain;
  const [transferLogs, awardLogs, redeemLogs] = await Promise.all([
    token.queryFilter(token.filters.Transfer(), 0),
    program.queryFilter(program.filters.TokensAwarded(), 0),
    program.queryFilter(program.filters.RewardRedeemed(), 0),
  ]);

  return {
    transfers: decoded(transferLogs).map(({ info, args }) => ({
      ...info,
      from: args.from,
      to: args.to,
      amount: Number(args.value),
    })),
    awards: decoded(awardLogs).map(({ info, args }) => ({
      ...info,
      customer: args.customer,
      amount: Number(args.amount),
      reason: args.reason,
      merchant: args.merchant,
    })),
    redemptions: decoded(redeemLogs).map(({ info, args }) => ({
      ...info,
      redemptionId: Number(args.redemptionId),
      customer: args.customer,
      rewardId: Number(args.rewardId),
      cost: Number(args.cost),
    })),
  };
}

/** Keeps only logs that ethers could decode with the ABI, and returns their arguments by name. */
function decoded(logs: (EventLog | Log)[]) {
  return logs
    .filter((log): log is EventLog => log instanceof EventLog)
    .map((log) => ({
      info: {
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        txHash: log.transactionHash,
        logIndex: log.index,
      },
      args: log.args.toObject(),
    }));
}

// Block timestamps never change, so we remember them. The key is the block hash (not the number),
// so the cache stays correct even when the local chain is restarted.
const blockTimes = new Map<string, number>();

/** Returns the timestamp of every block that contains one of the events. */
export async function fetchBlockTimes(chain: Chain, events: RawEvents): Promise<Map<string, number>> {
  const all = [...events.transfers, ...events.awards, ...events.redemptions];
  const missing = [...new Set(all.map((e) => e.blockHash))].filter((hash) => !blockTimes.has(hash));
  const blocks = await Promise.all(missing.map((hash) => chain.provider.getBlock(hash)));
  blocks.forEach((block, i) => {
    if (block) blockTimes.set(missing[i], block.timestamp);
  });
  return blockTimes;
}

/**
 * Merges the three event lists into one history, newest first.
 *
 * An award emits two events (Transfer from 0x0 + TokensAwarded) and a redemption emits two
 * (Transfer to 0x0 + RewardRedeemed). We show each action once, using the program event
 * because it has more details (reason, reward). Mints and burns that did not come from the
 * program are still shown as "mint" / "burn".
 */
export function buildActivities(
  events: RawEvents,
  rewardNames: string[],
  blockTimes: Map<string, number>,
): Activity[] {
  const awardTxs = new Set(events.awards.map((a) => a.txHash));
  const redeemTxs = new Set(events.redemptions.map((r) => r.txHash));
  const base = (e: EventInfo) => ({
    blockNumber: e.blockNumber,
    logIndex: e.logIndex,
    timestamp: blockTimes.get(e.blockHash) ?? 0,
    txHash: e.txHash,
  });

  const activities: Activity[] = [];

  for (const a of events.awards) {
    activities.push({ type: "award", from: null, to: a.customer, amount: a.amount, details: a.reason, merchant: a.merchant, ...base(a) });
  }

  for (const r of events.redemptions) {
    activities.push({
      type: "redeem",
      from: r.customer,
      to: null,
      amount: r.cost,
      details: rewardNames[r.rewardId] ?? `Reward #${r.rewardId}`,
      rewardId: r.rewardId,
      redemptionId: r.redemptionId,
      ...base(r),
    });
  }

  for (const t of events.transfers) {
    if (t.from === ZeroAddress) {
      if (!awardTxs.has(t.txHash)) {
        activities.push({ type: "mint", from: null, to: t.to, amount: t.amount, details: "Minted directly", ...base(t) });
      }
    } else if (t.to === ZeroAddress) {
      if (!redeemTxs.has(t.txHash)) {
        activities.push({ type: "burn", from: t.from, to: null, amount: t.amount, details: "Burned by holder", ...base(t) });
      }
    } else {
      activities.push({ type: "transfer", from: t.from, to: t.to, amount: t.amount, details: "Transfer", ...base(t) });
    }
  }

  return activities.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
}

/** True if the address sent, received, or (as merchant) awarded the tokens. */
export function involves(activity: Activity, address: string): boolean {
  const target = address.toLowerCase();
  return [activity.from, activity.to, activity.merchant].some((a) => a?.toLowerCase() === target);
}

/**
 * Rebuilds every balance only from Transfer events (mint = +, burn = -, transfer = -/+).
 * The result must always match balanceOf() on the contract: the history fully explains the state.
 */
export function computeBalances(transfers: TransferEvent[]): Map<string, number> {
  const balances = new Map<string, number>();
  const add = (address: string, delta: number) => balances.set(address, (balances.get(address) ?? 0) + delta);

  for (const t of transfers) {
    if (t.from !== ZeroAddress) add(t.from, -t.amount);
    if (t.to !== ZeroAddress) add(t.to, t.amount);
  }
  for (const [address, balance] of balances) {
    if (balance === 0) balances.delete(address);
  }
  return balances;
}

/** Totals for the statistics page. */
export function summarize(activities: Activity[]) {
  const sum = (types: ActivityType[]) =>
    activities.filter((a) => types.includes(a.type)).reduce((total, a) => total + a.amount, 0);

  return {
    totalIssued: sum(["award", "mint"]),
    totalRedeemed: sum(["redeem"]),
    totalBurned: sum(["redeem", "burn"]),
    totalTransferred: sum(["transfer"]),
    transactionCount: activities.length,
    countByType: Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, activities.filter((a) => a.type === t).length])),
  };
}
