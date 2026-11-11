// Everything that talks to MetaMask. MetaMask injects `window.ethereum` (an EIP-1193 provider)
// into every page. Through it the app asks for the user's address and lets the user sign transactions.
import { BrowserProvider } from "ethers";
import type { Eip1193Provider, JsonRpcSigner } from "ethers";

interface MetaMaskProvider extends Eip1193Provider {
  on?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: MetaMaskProvider;
  }
}

/** The local Hardhat node started with `npm run node` in 1-smart-contracts. */
export const LOCAL_CHAIN = {
  chainId: 31337,
  hexChainId: "0x7a69", // 31337 in hexadecimal
  name: "Hardhat Local",
  rpcUrl: "http://127.0.0.1:8545",
};

export function hasMetaMask(): boolean {
  return window.ethereum !== undefined;
}

function ethereum(): MetaMaskProvider {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");
  return window.ethereum;
}

/** Opens the MetaMask popup and asks the user to connect an account. */
export async function connectWallet(): Promise<string | null> {
  const accounts: string[] = await ethereum().request({ method: "eth_requestAccounts" });
  return accounts[0] ?? null;
}

/** Switches MetaMask to the local network, and adds the network first if MetaMask does not know it. */
export async function switchToLocalChain(): Promise<void> {
  try {
    await ethereum().request({ method: "wallet_switchEthereumChain", params: [{ chainId: LOCAL_CHAIN.hexChainId }] });
  } catch (err) {
    // 4902 = "unknown chain"
    if ((err as { code?: number }).code !== 4902) throw err;
    await ethereum().request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: LOCAL_CHAIN.hexChainId,
          chainName: LOCAL_CHAIN.name,
          rpcUrls: [LOCAL_CHAIN.rpcUrl],
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        },
      ],
    });
  }
}

/**
 * Reports the current account and network, and again every time the user changes them in MetaMask.
 * Returns a function that stops listening.
 */
export function watchWallet(onAccount: (address: string | null) => void, onChain: (chainId: number) => void) {
  const provider = window.ethereum;
  if (!provider) return () => {};

  // eth_accounts never opens a popup: it only returns accounts that were already connected.
  provider.request({ method: "eth_accounts" }).then((accounts: string[]) => onAccount(accounts[0] ?? null));
  provider.request({ method: "eth_chainId" }).then((hex: string) => onChain(Number(hex)));

  const handleAccounts = (accounts: string[]) => onAccount(accounts[0] ?? null);
  const handleChain = (hex: string) => onChain(Number(hex));
  provider.on?.("accountsChanged", handleAccounts);
  provider.on?.("chainChanged", handleChain);

  return () => {
    provider.removeListener?.("accountsChanged", handleAccounts);
    provider.removeListener?.("chainChanged", handleChain);
  };
}

/** A signer for the current MetaMask account. Every transaction sent with it opens a MetaMask popup. */
export async function getSigner(): Promise<JsonRpcSigner> {
  // A new BrowserProvider each time, so a network change in MetaMask never leaves us with a stale one.
  return new BrowserProvider(ethereum()).getSigner();
}
