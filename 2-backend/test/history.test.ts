// Unit tests for the history logic. They use hand-made events, so no blockchain is needed.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZeroAddress } from "ethers";
import { buildActivities, computeBalances, involves, summarize } from "../src/history.ts";
import type { RawEvents } from "../src/history.ts";

const ALICE = "0x00000000000000000000000000000000000A11CE";
const BOB = "0x0000000000000000000000000000000000000B0B";
const MERCHANT = "0x000000000000000000000000000000000000AE7C";

const at = (block: number, tx: string, logIndex = 0) => ({
  blockNumber: block,
  blockHash: `0xblock${block}`,
  txHash: tx,
  logIndex,
});

// Block 1: merchant awards Alice 100 (Transfer from 0x0 + TokensAwarded in the same tx)
// Block 2: Alice sends 30 to Bob
// Block 3: Bob redeems reward 0 for 20 (Transfer to 0x0 + RewardRedeemed in the same tx)
// Block 4: Alice burns 10 herself (only a Transfer to 0x0)
const events: RawEvents = {
  transfers: [
    { ...at(1, "0xaward"), from: ZeroAddress, to: ALICE, amount: 100 },
    { ...at(2, "0xtransfer"), from: ALICE, to: BOB, amount: 30 },
    { ...at(3, "0xredeem"), from: BOB, to: ZeroAddress, amount: 20 },
    { ...at(4, "0xburn"), from: ALICE, to: ZeroAddress, amount: 10 },
  ],
  awards: [{ ...at(1, "0xaward", 1), customer: ALICE, amount: 100, reason: "Purchase #1", merchant: MERCHANT }],
  redemptions: [{ ...at(3, "0xredeem", 1), redemptionId: 1, customer: BOB, rewardId: 0, cost: 20 }],
};
const blockTimes = new Map([1, 2, 3, 4].map((n) => [`0xblock${n}`, 1_700_000_000 + n]));

describe("buildActivities", () => {
  const activities = buildActivities(events, ["Free coffee"], blockTimes);

  it("shows every action once, newest first", () => {
    assert.deepEqual(
      activities.map((a) => a.type),
      ["burn", "redeem", "transfer", "award"],
    );
  });

  it("uses the program events for awards and redemptions", () => {
    const award = activities.find((a) => a.type === "award");
    const redeem = activities.find((a) => a.type === "redeem");

    assert.equal(award?.details, "Purchase #1");
    assert.equal(award?.merchant, MERCHANT);
    assert.equal(redeem?.details, "Free coffee");
    assert.equal(redeem?.redemptionId, 1);
  });

  it("adds the block timestamp", () => {
    assert.equal(activities.at(-1)?.timestamp, 1_700_000_001);
  });
});

describe("involves", () => {
  const activities = buildActivities(events, ["Free coffee"], blockTimes);

  it("finds the activities of one address, in any letter case", () => {
    assert.equal(activities.filter((a) => involves(a, BOB.toLowerCase())).length, 2);
    // The merchant is involved in the award they made.
    assert.equal(activities.filter((a) => involves(a, MERCHANT)).length, 1);
  });
});

describe("computeBalances", () => {
  it("rebuilds balances from Transfer events only", () => {
    const balances = computeBalances(events.transfers);

    assert.equal(balances.get(ALICE), 60); // 100 - 30 - 10
    assert.equal(balances.get(BOB), 10); // 30 - 20
    assert.equal(balances.has(ZeroAddress), false);
  });

  it("drops addresses with a zero balance", () => {
    const balances = computeBalances([
      { ...at(1, "0x1"), from: ZeroAddress, to: BOB, amount: 5 },
      { ...at(2, "0x2"), from: BOB, to: ZeroAddress, amount: 5 },
    ]);
    assert.equal(balances.size, 0);
  });
});

describe("summarize", () => {
  it("adds up the amounts per type", () => {
    const summary = summarize(buildActivities(events, ["Free coffee"], blockTimes));

    assert.equal(summary.totalIssued, 100);
    assert.equal(summary.totalRedeemed, 20);
    assert.equal(summary.totalBurned, 30);
    assert.equal(summary.totalTransferred, 30);
    assert.equal(summary.transactionCount, 4);
  });
});
