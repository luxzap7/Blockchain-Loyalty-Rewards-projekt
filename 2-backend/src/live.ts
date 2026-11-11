// Live tracking: prints every new loyalty event in the terminal while the server runs.
import { ZeroAddress } from "ethers";
import type { ContractEventPayload } from "ethers";
import type { Chain } from "./chain.ts";

export async function startLiveLog(chain: Chain, display: (address: string) => string): Promise<void> {
  const { provider, token, program } = chain;

  // The node can also return events from the current block when a subscription starts.
  // Those are old, so only events from later blocks are printed.
  const startBlock = await provider.getBlockNumber();
  const isNew = (payload: ContractEventPayload) => payload.log.blockNumber > startBlock;

  await program.on(
    "TokensAwarded",
    (customer: string, amount: bigint, reason: string, merchant: string, payload: ContractEventPayload) => {
      if (!isNew(payload)) return;
      log(`AWARD     ${display(merchant)} gave ${amount} tokens to ${display(customer)} - "${reason}"`);
    },
  );

  await program.on(
    "RewardRedeemed",
    async (redemptionId: bigint, customer: string, rewardId: bigint, cost: bigint, payload: ContractEventPayload) => {
      if (!isNew(payload)) return;
      const reward = await program.getReward(rewardId);
      log(`REDEEM    ${display(customer)} spent ${cost} tokens on "${reward.name}" (voucher #${redemptionId})`);
    },
  );

  await token.on("Transfer", (from: string, to: string, value: bigint, payload: ContractEventPayload) => {
    // Mints and burns are already printed above as AWARD / REDEEM.
    if (!isNew(payload) || from === ZeroAddress || to === ZeroAddress) return;
    log(`TRANSFER  ${display(from)} sent ${value} tokens to ${display(to)}`);
  });
}

function log(text: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ${text}`);
}
