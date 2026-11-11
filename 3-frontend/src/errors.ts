// Turns errors from MetaMask / ethers / the contracts into short messages for the user.
import { Interface, isError } from "ethers";
import type { Deployment } from "./api";

// Custom errors of our contracts and of OpenZeppelin, and what they mean.
const MESSAGES: Record<string, string> = {
  AccessControlUnauthorizedAccount: "Your account does not have the role needed for this action.",
  ERC20InsufficientBalance: "You do not have enough tokens.",
  ERC20InsufficientAllowance: "The program is not allowed to spend that many of your tokens.",
  ERC20InvalidReceiver: "Invalid receiver address.",
  RewardInactive: "This reward is not available at the moment.",
  RewardOutOfStock: "This reward is out of stock.",
  RewardNotFound: "This reward does not exist.",
  InvalidAddress: "Invalid address.",
  InvalidAmount: "The amount must be greater than 0.",
  EmptyName: "The name cannot be empty.",
};

export function describeError(err: unknown, deployment: Deployment | null): string {
  // The user clicked "Reject" in MetaMask (4001 is the MetaMask code for it).
  if (isError(err, "ACTION_REJECTED") || (err as { code?: unknown })?.code === 4001) {
    return "You rejected the request in MetaMask.";
  }

  // A revert from one of our contracts: find the error data and decode it with the ABIs.
  if (deployment) {
    const abis = [deployment.contracts.LoyaltyProgram.abi, deployment.contracts.LoyaltyToken.abi];
    for (const data of findHexData(err)) {
      for (const abi of abis) {
        const decoded = tryParseError(abi, data);
        if (decoded) return `${MESSAGES[decoded] ?? "The smart contract rejected the transaction."} (${decoded})`;
      }
    }
  }

  if (err instanceof Error) return (err as { shortMessage?: string }).shortMessage ?? err.message;
  return String(err);
}

function tryParseError(abi: Deployment["contracts"]["LoyaltyToken"]["abi"], data: string): string | null {
  try {
    return new Interface(abi).parseError(data)?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Collects every "data" hex string inside the error. MetaMask and ethers nest the revert data
 * differently (err.data, err.info.error.data, err.error.data.data, ...), so we simply search.
 * The "transaction" field is skipped: its data is our own call, not the error.
 */
function findHexData(value: unknown, depth = 0, found: string[] = []): string[] {
  if (depth > 6 || value === null || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    if (key === "transaction") continue;
    if (key === "data" && typeof child === "string" && /^0x[0-9a-fA-F]{8}/.test(child)) found.push(child);
    else findHexData(child, depth + 1, found);
  }
  return found;
}
