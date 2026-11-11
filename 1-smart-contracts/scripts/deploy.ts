// Deploys the loyalty program and writes the addresses + ABIs to deployments/<network>.json.
//
// Usage (two terminals):
//   npm run node            # terminal 1: local blockchain on http://localhost:8545
//   npm run deploy:local    # terminal 2: this script
//
// Token name/symbol and the initial reward catalog come from config/program.json.
import { network } from "hardhat";
import { mkdir, readFile, writeFile } from "node:fs/promises";

interface ProgramConfig {
  token: { name: string; symbol: string };
  rewards: { name: string; cost: number; stock: number }[];
}

const config: ProgramConfig = JSON.parse(
  await readFile(new URL("../config/program.json", import.meta.url), "utf8"),
);

const { ethers, networkName } = await network.create();
const { chainId } = await ethers.provider.getNetwork();

// Local Hardhat accounts: #0 = admin (deployer), #1 = merchant.
// Accounts #2 and up are free to use as customers.
const [admin, merchant] = await ethers.getSigners();

console.log(`Network:  ${networkName} (chainId ${chainId})`);
console.log(`Admin:    ${admin.address}`);
console.log(`Merchant: ${merchant.address}\n`);

// 1. Deploy the token
const token = await ethers.deployContract("LoyaltyToken", [config.token.name, config.token.symbol]);
await token.waitForDeployment();
const tokenAddress = await token.getAddress();
console.log(`LoyaltyToken   deployed at ${tokenAddress}`);

// 2. Deploy the program, linked to the token
const program = await ethers.deployContract("LoyaltyProgram", [tokenAddress]);
await program.waitForDeployment();
const programAddress = await program.getAddress();
console.log(`LoyaltyProgram deployed at ${programAddress}\n`);

// 3. Allow the program to mint tokens
await (await token.grantRole(await token.MINTER_ROLE(), programAddress)).wait();
console.log("Granted MINTER_ROLE on the token to the program");

// 4. Register the merchant
await (await program.grantRole(await program.MERCHANT_ROLE(), merchant.address)).wait();
console.log("Granted MERCHANT_ROLE on the program to the merchant\n");

// 5. Fill the reward catalog
for (const reward of config.rewards) {
  await (await program.addReward(reward.name, reward.cost, reward.stock)).wait();
  console.log(`Added reward: ${reward.name} (cost ${reward.cost}, stock ${reward.stock})`);
}

// 6. Save addresses + ABIs for the backend (Part 2) and the frontend (Part 3)
if (networkName === "default") {
  console.log("\nIn-memory network: nothing saved, this chain is gone when the script ends.");
  console.log("Start `npm run node` and use `npm run deploy:local` for a deployment that stays.");
} else {
  const deployment = {
    network: networkName,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    accounts: { admin: admin.address, merchant: merchant.address },
    contracts: {
      LoyaltyToken: { address: tokenAddress, abi: JSON.parse(token.interface.formatJson()) },
      LoyaltyProgram: { address: programAddress, abi: JSON.parse(program.interface.formatJson()) },
    },
  };

  const outDir = new URL("../deployments/", import.meta.url);
  await mkdir(outDir, { recursive: true });
  const outFile = new URL(`${networkName}.json`, outDir);
  await writeFile(outFile, JSON.stringify(deployment, null, 2) + "\n");
  console.log(`\nSaved deployment to deployments/${networkName}.json`);
}
