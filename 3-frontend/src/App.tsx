import { useCallback, useEffect, useState } from "react";
import { getAddress } from "ethers";
import type { Signer } from "ethers";
import { api } from "./api";
import type { Account, Deployment } from "./api";
import { describeError } from "./errors";
import { useApi } from "./useApi";
import { LOCAL_CHAIN, connectWallet, getSigner, switchToLocalChain, watchWallet } from "./wallet";
import AdminTab from "./components/AdminTab";
import ExplorerTab from "./components/ExplorerTab";
import MerchantTab from "./components/MerchantTab";
import RewardsTab from "./components/RewardsTab";
import WalletBar from "./components/WalletBar";
import WalletTab from "./components/WalletTab";

type TabId = "wallet" | "rewards" | "merchant" | "admin" | "explorer";

const TABS: { id: TabId; label: string }[] = [
  { id: "wallet", label: "My wallet" },
  { id: "rewards", label: "Rewards" },
  { id: "merchant", label: "Merchant" },
  { id: "admin", label: "Admin" },
  { id: "explorer", label: "Explorer" },
];

/** How often data is reloaded from the backend, so changes made by others show up too. */
const REFRESH_MS = 4000;

interface Status {
  kind: "pending" | "success" | "error";
  text: string;
}

export type TxAction = (signer: Signer, progress: (text: string) => void) => Promise<string>;

/** Everything the tabs need, passed down as one prop. */
export interface AppContext {
  deployment: Deployment;
  address: string | null; // connected MetaMask account
  account: Account | null; // its balance and roles
  knownAccounts: Account[]; // admin, merchant and demo customers
  refreshKey: number; // changes on every refresh; tabs reload their data when it changes
  runTx: (label: string, action: TxAction) => Promise<boolean>;
}

export default function App() {
  const [tab, setTab] = useState<TabId>("wallet");
  const [refreshKey, setRefreshKey] = useState(0);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Follow the account and network selected in MetaMask.
  useEffect(
    () =>
      watchWallet(
        (account) => setAddress(account ? getAddress(account) : null),
        (id) => setChainId(id),
      ),
    [],
  );

  // Contract addresses + ABIs. Until the backend answers, try again on every refresh.
  useEffect(() => {
    if (deployment) return;
    api
      .deployment()
      .then((result) => {
        setDeployment(result);
        setBackendError(null);
      })
      .catch((err: Error) => setBackendError(err.message));
  }, [deployment, refreshKey]);

  const knownAccounts = useApi(api.accounts, [refreshKey]);
  const account = useApi(() => (address ? api.account(address) : Promise.resolve(null)), [address, refreshKey]);

  const wrongNetwork = address !== null && chainId !== null && chainId !== LOCAL_CHAIN.chainId;

  /** Sends a transaction with MetaMask and shows its progress and result in the status bar. */
  async function runTx(label: string, action: TxAction): Promise<boolean> {
    try {
      if (!address) throw new Error("Connect MetaMask first.");
      if (wrongNetwork) throw new Error(`Switch MetaMask to the "${LOCAL_CHAIN.name}" network first.`);

      setStatus({ kind: "pending", text: `${label}: confirm in MetaMask...` });
      const signer = await getSigner();
      const message = await action(signer, (text) => setStatus({ kind: "pending", text: `${label}: ${text}` }));
      setStatus({ kind: "success", text: message });
      refresh();
      return true;
    } catch (err) {
      setStatus({ kind: "error", text: `${label} failed: ${describeError(err, deployment)}` });
      return false;
    }
  }

  async function onConnect() {
    try {
      const connected = await connectWallet();
      setAddress(connected ? getAddress(connected) : null);
    } catch (err) {
      setStatus({ kind: "error", text: describeError(err, deployment) });
    }
  }

  async function onSwitchNetwork() {
    try {
      await switchToLocalChain();
    } catch (err) {
      setStatus({ kind: "error", text: describeError(err, deployment) });
    }
  }

  if (!deployment) {
    return (
      <div className="app">
        <header className="header">
          <h1>Loyalty Rewards</h1>
        </header>
        <div className="status error">{backendError ?? "Loading..."}</div>
        <div className="card">
          <h2>Start the project</h2>
          <ol>
            <li>
              <code>1-smart-contracts</code>: <code>npm run node</code> (keep it running), then{" "}
              <code>npm run deploy:local</code>
            </li>
            <li>
              <code>2-backend</code>: <code>npm start</code> (and optionally <code>npm run seed</code> for demo data)
            </li>
            <li>This page reconnects by itself.</li>
          </ol>
        </div>
      </div>
    );
  }

  const ctx: AppContext = {
    deployment,
    address,
    account: account.data,
    knownAccounts: knownAccounts.data ?? [],
    refreshKey,
    runTx,
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Loyalty Rewards</h1>
        <WalletBar
          address={address}
          account={account.data}
          symbol={deployment.token.symbol}
          wrongNetwork={wrongNetwork}
          onConnect={onConnect}
          onSwitchNetwork={onSwitchNetwork}
        />
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {status && (
        <div className={`status ${status.kind}`}>
          <span>{status.text}</span>
          {status.kind !== "pending" && (
            <button className="close" onClick={() => setStatus(null)} aria-label="Close">
              ×
            </button>
          )}
        </div>
      )}
      {knownAccounts.error && <div className="status error">{knownAccounts.error}</div>}

      <main>
        {tab === "wallet" && <WalletTab ctx={ctx} />}
        {tab === "rewards" && <RewardsTab ctx={ctx} />}
        {tab === "merchant" && <MerchantTab ctx={ctx} />}
        {tab === "admin" && <AdminTab ctx={ctx} />}
        {tab === "explorer" && <ExplorerTab ctx={ctx} />}
      </main>

      <footer className="footer">
        {deployment.token.name} ({deployment.token.symbol}) · token {deployment.contracts.LoyaltyToken.address} ·
        program {deployment.contracts.LoyaltyProgram.address} · chain {deployment.chainId}
      </footer>
    </div>
  );
}
