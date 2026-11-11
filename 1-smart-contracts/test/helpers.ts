import { network } from "hardhat";
import type { Contract, Signer } from "ethers";

// One connection to a fresh in-memory Hardhat chain, shared by all test files.
export const { ethers, networkHelpers } = await network.create();

export const TOKEN_NAME = "Loyalty Token";
export const TOKEN_SYMBOL = "LOYAL";

/**
 * Returns the same contract, but transactions are sent by `signer`.
 * (ethers types contract.connect() as a plain BaseContract, so we cast it back.)
 */
export function connectAs(contract: Contract, signer: Signer): Contract {
  return contract.connect(signer) as Contract;
}

/**
 * Deploys both contracts and wires them together, the same way scripts/deploy.ts does:
 * - the program gets MINTER_ROLE on the token
 * - `merchant` gets MERCHANT_ROLE on the program
 */
export async function deployFixture() {
  const [admin, merchant, alice, bob, outsider] = await ethers.getSigners();

  const token = await ethers.deployContract("LoyaltyToken", [TOKEN_NAME, TOKEN_SYMBOL]);
  const program = await ethers.deployContract("LoyaltyProgram", [await token.getAddress()]);

  await token.grantRole(await token.MINTER_ROLE(), await program.getAddress());
  await program.grantRole(await program.MERCHANT_ROLE(), merchant.address);

  return { token, program, admin, merchant, alice, bob, outsider };
}

/**
 * deployFixture + two rewards in the catalog + Alice already has 200 tokens.
 * - reward 0: "Free coffee", cost 50, stock 2
 * - reward 1: "Branded mug", cost 300, stock 10
 */
export async function programWithRewardsFixture() {
  const fixture = await deployFixture();
  const { program, merchant, alice } = fixture;

  await program.addReward("Free coffee", 50, 2);
  await program.addReward("Branded mug", 300, 10);
  await connectAs(program, merchant).awardTokens(alice.address, 200, "Welcome bonus");

  return fixture;
}
