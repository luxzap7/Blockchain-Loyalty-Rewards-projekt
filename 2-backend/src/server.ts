// REST API of the loyalty program (Part 2).
// Everything is read directly from the blockchain; the backend has no database and cannot change
// any data. Transactions are only sent by users from their own wallet (Part 3).
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { getAddress, isAddress, ZeroHash } from "ethers";
import { loadKnownAccounts, nameLookup, shortAddress } from "./accounts.ts";
import { connect } from "./chain.ts";
import type { Chain } from "./chain.ts";
import { PORT, RPC_URL } from "./config.ts";
import {
  ACTIVITY_TYPES,
  buildActivities,
  computeBalances,
  fetchBlockTimes,
  fetchEvents,
  involves,
  summarize,
} from "./history.ts";
import type { Activity, ActivityType } from "./history.ts";
import { startLiveLog } from "./live.ts";

let chain: Chain;
try {
  chain = await connect();
} catch (err) {
  console.error(`\n${(err as Error).message}\n`);
  process.exit(1);
}

const { provider, deployment, token, program } = chain;
const knownAccounts = await loadKnownAccounts(chain);
const nameOf = nameLookup(knownAccounts);
const display = (address: string) => nameOf(address) ?? shortAddress(address);

const ADMIN_ROLE = ZeroHash; // DEFAULT_ADMIN_ROLE in OpenZeppelin AccessControl is bytes32(0)
const MERCHANT_ROLE: string = await program.MERCHANT_ROLE();
const [TOKEN_NAME, TOKEN_SYMBOL]: string[] = await Promise.all([token.name(), token.symbol()]);

interface RewardStruct {
  name: string;
  cost: bigint;
  stock: bigint;
  active: boolean;
}

/** Reads the reward catalog from the contract. */
async function readRewards() {
  const rewards: RewardStruct[] = await program.getAllRewards();
  return rewards.map((r, id) => ({
    id,
    name: r.name,
    cost: Number(r.cost),
    stock: Number(r.stock),
    active: r.active,
  }));
}

/** Reads all events and builds the full history. */
async function readHistory() {
  const [events, rewards] = await Promise.all([fetchEvents(chain), readRewards()]);
  const blockTimes = await fetchBlockTimes(chain, events);
  const activities = buildActivities(events, rewards.map((r) => r.name), blockTimes);
  return { events, activities };
}

/** Balance and roles of one address. */
async function readAccount(address: string) {
  const [balance, isAdmin, isMerchant] = await Promise.all([
    token.balanceOf(address),
    program.hasRole(ADMIN_ROLE, address),
    program.hasRole(MERCHANT_ROLE, address),
  ]);
  return { address, name: nameOf(address), balance: Number(balance), isAdmin, isMerchant };
}

/** Returns the checksummed address, or null if the text is not a valid address. */
function parseAddress(text: string): string | null {
  return isAddress(text) ? getAddress(text) : null;
}

/** Applies the optional ?type= and ?limit= query parameters. */
function applyQuery(activities: Activity[], query: Request["query"]): Activity[] | string {
  let result = activities;
  if (typeof query.type === "string") {
    if (!ACTIVITY_TYPES.includes(query.type as ActivityType)) {
      return `Unknown type "${query.type}". Use one of: ${ACTIVITY_TYPES.join(", ")}`;
    }
    result = result.filter((a) => a.type === query.type);
  }
  if (typeof query.limit === "string") {
    const limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1) return "limit must be a positive whole number";
    result = result.slice(0, limit);
  }
  return result;
}

const app = express();

// GET /api/health - is the blockchain reachable?
app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, rpcUrl: RPC_URL, chainId: deployment.chainId, blockNumber: await provider.getBlockNumber() });
});

// GET /api/deployment - contract addresses and ABIs (the frontend needs them to send transactions)
app.get("/api/deployment", (_req, res) => {
  res.json({ ...deployment, token: { name: TOKEN_NAME, symbol: TOKEN_SYMBOL } });
});

// GET /api/stats - totals for the statistics page
app.get("/api/stats", async (_req, res) => {
  const [{ events, activities }, name, symbol, totalSupply, redemptionCount, blockNumber] = await Promise.all([
    readHistory(),
    token.name(),
    token.symbol(),
    token.totalSupply(),
    program.redemptionCount(),
    provider.getBlockNumber(),
  ]);

  res.json({
    token: { name, symbol, address: deployment.contracts.LoyaltyToken.address },
    totalSupply: Number(totalSupply),
    ...summarize(activities),
    holderCount: computeBalances(events.transfers).size,
    redemptionCount: Number(redemptionCount),
    blockNumber,
  });
});

// GET /api/rewards - the reward catalog
app.get("/api/rewards", async (_req, res) => {
  res.json(await readRewards());
});

// GET /api/accounts - the known local accounts (admin, merchant, demo customers) with balances and roles
app.get("/api/accounts", async (_req, res) => {
  res.json(await Promise.all(knownAccounts.map((a) => readAccount(a.address))));
});

// GET /api/accounts/:address - balance and roles of any address
app.get("/api/accounts/:address", async (req, res) => {
  const address = parseAddress(req.params.address);
  if (!address) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  res.json(await readAccount(address));
});

// GET /api/holders - all addresses that hold tokens, rebuilt from Transfer events, biggest first
app.get("/api/holders", async (_req, res) => {
  const { transfers } = await fetchEvents(chain);
  const holders = [...computeBalances(transfers)]
    .map(([address, balance]) => ({ address, name: nameOf(address), balance }))
    .sort((a, b) => b.balance - a.balance);
  res.json(holders);
});

// GET /api/transactions?type=redeem&limit=10 - the full history, newest first
app.get("/api/transactions", async (req, res) => {
  const result = applyQuery((await readHistory()).activities, req.query);
  if (typeof result === "string") {
    res.status(400).json({ error: result });
    return;
  }
  res.json(result);
});

// GET /api/transactions/:address - the history of one address
app.get("/api/transactions/:address", async (req, res) => {
  const address = parseAddress(req.params.address);
  if (!address) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const own = (await readHistory()).activities.filter((a) => involves(a, address));
  const result = applyQuery(own, req.query);
  if (typeof result === "string") {
    res.status(400).json({ error: result });
    return;
  }
  res.json(result);
});

// Unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Errors (Express 5 also catches errors thrown inside async handlers)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Could not read from the blockchain. Is the node running?", details: err.message });
});

app.listen(PORT, async () => {
  console.log(`Loyalty backend running on http://localhost:${PORT}/api`);
  console.log(`Blockchain: ${RPC_URL} (chainId ${deployment.chainId})`);
  console.log(`Token:      ${deployment.contracts.LoyaltyToken.address}`);
  console.log(`Program:    ${deployment.contracts.LoyaltyProgram.address}\n`);
  await startLiveLog(chain, display);
  console.log("Watching for new events...\n");
});
