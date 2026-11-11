// Connection to the local blockchain and to the two contracts deployed by Part 1.
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider } from "ethers";
import type { InterfaceAbi, Signer } from "ethers";
import { DEPLOYMENT_FILE, RPC_URL } from "./config.ts";

/** Content of 1-smart-contracts/deployments/localhost.json. */
export interface Deployment {
  network: string;
  chainId: number;
  deployedAt: string;
  accounts: { admin: string; merchant: string };
  contracts: {
    LoyaltyToken: { address: string; abi: InterfaceAbi };
    LoyaltyProgram: { address: string; abi: InterfaceAbi };
  };
}

export interface Chain {
  provider: JsonRpcProvider;
  deployment: Deployment;
  token: Contract; // read-only (no signer)
  program: Contract; // read-only (no signer)
}

/** Connects to the blockchain and checks that the contracts from the deployment file exist. */
export async function connect(): Promise<Chain> {
  const deployment = await readDeployment();

  // staticNetwork: the chain id is known from the deployment file, so ethers does not have to
  // detect it (and does not retry forever when the node is not running).
  const provider = new JsonRpcProvider(RPC_URL, deployment.chainId, {
    staticNetwork: true,
    pollingInterval: 1000, // check for new events every second
  });

  try {
    await provider.getBlockNumber();
  } catch {
    throw new Error(`Cannot reach the blockchain at ${RPC_URL}.\nStart it with "npm run node" in 1-smart-contracts.`);
  }

  const { LoyaltyToken, LoyaltyProgram } = deployment.contracts;
  for (const { address } of [LoyaltyToken, LoyaltyProgram]) {
    if ((await provider.getCode(address)) === "0x") {
      throw new Error(
        `No contract found at ${address}.\n` +
          `The node was probably restarted. Run "npm run deploy:local" in 1-smart-contracts again.`,
      );
    }
  }

  return {
    provider,
    deployment,
    token: new Contract(LoyaltyToken.address, LoyaltyToken.abi, provider),
    program: new Contract(LoyaltyProgram.address, LoyaltyProgram.abi, provider),
  };
}

async function readDeployment(): Promise<Deployment> {
  try {
    return JSON.parse(await readFile(DEPLOYMENT_FILE, "utf8"));
  } catch {
    throw new Error(
      `Deployment file not found: ${DEPLOYMENT_FILE}\nRun "npm run deploy:local" in 1-smart-contracts first.`,
    );
  }
}

/**
 * Returns the same contract, but transactions are signed by `signer`.
 * (ethers types contract.connect() as a plain BaseContract, so we cast it back.)
 */
export function withSigner(contract: Contract, signer: Signer): Contract {
  return contract.connect(signer) as Contract;
}
