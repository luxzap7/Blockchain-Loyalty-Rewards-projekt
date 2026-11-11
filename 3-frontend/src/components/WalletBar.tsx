import type { Account } from "../api";
import { shortAddress } from "../format";
import { LOCAL_CHAIN, hasMetaMask } from "../wallet";

interface Props {
  address: string | null;
  account: Account | null;
  symbol: string;
  wrongNetwork: boolean;
  onConnect: () => void;
  onSwitchNetwork: () => void;
}

/** Top right corner: connect button, or the connected account with its balance and roles. */
export default function WalletBar({ address, account, symbol, wrongNetwork, onConnect, onSwitchNetwork }: Props) {
  if (!hasMetaMask()) {
    return (
      <div className="wallet-bar">
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
          Install MetaMask to use the app
        </a>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="wallet-bar">
        <button onClick={onConnect}>Connect MetaMask</button>
      </div>
    );
  }

  return (
    <div className="wallet-bar">
      {wrongNetwork && (
        <button className="warning" onClick={onSwitchNetwork}>
          Wrong network: switch to {LOCAL_CHAIN.name}
        </button>
      )}
      <div className="wallet-info">
        <strong>{account?.name ?? "Account"}</strong> <span className="muted">{shortAddress(address)}</span>
        <div>
          <span className="balance">
            {account?.balance ?? "..."} {symbol}
          </span>
          {account?.isAdmin && <span className="badge role">Admin</span>}
          {account?.isMerchant && <span className="badge role">Merchant</span>}
        </div>
      </div>
    </div>
  );
}
