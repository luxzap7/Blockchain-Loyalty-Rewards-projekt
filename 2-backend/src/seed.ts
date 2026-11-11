// Fills the local blockchain with demo activity from config/demo.json:
// the merchant awards tokens, and customers transfer and redeem them.
//
// Run after deploying the contracts (1-smart-contracts: npm run deploy:local):
//   npm run seed
import type { JsonRpcSigner } from "ethers";
import { connect, withSigner } from "./chain.ts";
import type { Chain } from "./chain.ts";
import { loadDemoConfig } from "./config.ts";

let chain: Chain;
try {
  chain = await connect();
} catch (err) {
  console.error(`\n${(err as Error).message}\n`);
  process.exit(1);
}

const { provider, deployment, token, program } = chain;
const programAddress = await program.getAddress();
const demo = await loadDemoConfig();

// The local Hardhat node has its 20 test accounts unlocked, so it can sign for them directly.
// (In the frontend, MetaMask signs instead.)
const merchant = await provider.getSigner(deployment.accounts.merchant);
const customers = new Map<string, JsonRpcSigner>();
for (const c of demo.customers) {
  customers.set(c.name, await provider.getSigner(c.accountIndex));
}

function customer(name: string): JsonRpcSigner {
  const signer = customers.get(name);
  if (!signer) throw new Error(`Unknown customer "${name}" in config/demo.json`);
  return signer;
}

console.log(`Seeding ${demo.steps.length} demo steps...\n`);

for (const step of demo.steps) {
  if ("award" in step) {
    const { to, amount, reason } = step.award;
    const tx = await withSigner(program, merchant).awardTokens(customer(to).address, amount, reason);
    await tx.wait();
    console.log(`AWARD     Merchant gave ${amount} tokens to ${to} - "${reason}"`);
  } else if ("transfer" in step) {
    const { from, to, amount } = step.transfer;
    const tx = await withSigner(token, customer(from)).transfer(customer(to).address, amount);
    await tx.wait();
    console.log(`TRANSFER  ${from} sent ${amount} tokens to ${to}`);
  } else if ("redeem" in step) {
    const { customer: name, rewardId } = step.redeem;
    const signer = customer(name);
    const reward = await program.getReward(rewardId);
    const balance: bigint = await token.balanceOf(signer.address);

    if (!reward.active || reward.stock === 0n || balance < reward.cost) {
      console.log(`SKIPPED   ${name} cannot redeem "${reward.name}" (balance ${balance}, cost ${reward.cost})`);
      continue;
    }

    // Redeeming needs two transactions: approve (allow the program to spend), then redeem.
    await (await withSigner(token, signer).approve(programAddress, reward.cost)).wait();
    const receipt = await (await withSigner(program, signer).redeem(rewardId)).wait();

    const event = receipt.logs
      .map((log: { topics: string[]; data: string }) => program.interface.parseLog(log))
      .find((parsed: { name: string } | null) => parsed?.name === "RewardRedeemed");
    console.log(`REDEEM    ${name} spent ${reward.cost} tokens on "${reward.name}" (voucher #${event?.args.redemptionId})`);
  }
}

console.log("\nBalances now:");
for (const [name, signer] of customers) {
  console.log(`  ${name.padEnd(8)} ${await token.balanceOf(signer.address)}`);
}
console.log(`  Total supply ${await token.totalSupply()}`);
