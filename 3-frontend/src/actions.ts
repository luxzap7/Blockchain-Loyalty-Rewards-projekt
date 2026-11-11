// All transactions the app can send. Each function gets a signer (MetaMask in the browser) and
// waits until the transaction is included in a block.
// This file has no React code, so the same functions can also be run from a Node script.
import { Contract } from "ethers";
import type { ContractTransactionReceipt, Signer } from "ethers";
import type { Deployment } from "./api";

function contracts(deployment: Deployment, signer: Signer) {
  const { LoyaltyToken, LoyaltyProgram } = deployment.contracts;
  return {
    token: new Contract(LoyaltyToken.address, LoyaltyToken.abi, signer),
    program: new Contract(LoyaltyProgram.address, LoyaltyProgram.abi, signer),
  };
}

/** Customer: send own tokens to another address (ERC-20 transfer). */
export async function transferTokens(deployment: Deployment, signer: Signer, to: string, amount: number) {
  const { token } = contracts(deployment, signer);
  await (await token.transfer(to, amount)).wait();
}

/**
 * Customer: redeem a reward. Needs up to two transactions:
 * 1. approve: allow the program contract to spend `cost` tokens (skipped if already allowed)
 * 2. redeem:  the program burns the tokens and records the redemption
 * Returns the redemption id (the voucher number).
 */
export async function redeemReward(
  deployment: Deployment,
  signer: Signer,
  rewardId: number,
  cost: number,
  progress: (text: string) => void = () => {},
): Promise<number | null> {
  const { token, program } = contracts(deployment, signer);
  const programAddress = deployment.contracts.LoyaltyProgram.address;

  const allowance: bigint = await token.allowance(await signer.getAddress(), programAddress);
  if (allowance < BigInt(cost)) {
    progress("Step 1 of 2: allow the program to spend your tokens. Confirm in MetaMask...");
    await (await token.approve(programAddress, cost)).wait();
  }

  progress("Step 2 of 2: redeem the reward. Confirm in MetaMask...");
  const receipt: ContractTransactionReceipt = await (await program.redeem(rewardId)).wait();

  // The voucher number is in the RewardRedeemed event of the receipt.
  for (const log of receipt.logs) {
    const event = program.interface.parseLog(log);
    if (event?.name === "RewardRedeemed") return Number(event.args.redemptionId);
  }
  return null;
}

/** Merchant: award new tokens to a customer. */
export async function awardTokens(
  deployment: Deployment,
  signer: Signer,
  customer: string,
  amount: number,
  reason: string,
) {
  const { program } = contracts(deployment, signer);
  await (await program.awardTokens(customer, amount, reason)).wait();
}

/** Admin: add a reward to the catalog. */
export async function addReward(deployment: Deployment, signer: Signer, name: string, cost: number, stock: number) {
  const { program } = contracts(deployment, signer);
  await (await program.addReward(name, cost, stock)).wait();
}

/** Admin: change price, stock or the active flag of a reward. */
export async function updateReward(
  deployment: Deployment,
  signer: Signer,
  rewardId: number,
  cost: number,
  stock: number,
  active: boolean,
) {
  const { program } = contracts(deployment, signer);
  await (await program.updateReward(rewardId, cost, stock, active)).wait();
}
