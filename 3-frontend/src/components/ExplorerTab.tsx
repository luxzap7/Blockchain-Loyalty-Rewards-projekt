import { useState } from "react";
import type { AppContext } from "../App";
import { api } from "../api";
import type { ActivityType } from "../api";
import { displayAddress } from "../format";
import { useApi } from "../useApi";
import TransactionTable from "./TransactionTable";

/** Public view (no wallet needed): statistics, token holders and the full transaction history. */
export default function ExplorerTab({ ctx }: { ctx: AppContext }) {
  const { knownAccounts, refreshKey, deployment } = ctx;
  const [type, setType] = useState<ActivityType | "">("");
  const stats = useApi(api.stats, [refreshKey]);
  const holders = useApi(api.holders, [refreshKey]);
  const transactions = useApi(() => api.transactions({ type: type || undefined }), [type, refreshKey]);
  const symbol = deployment.token.symbol;

  const s = stats.data;
  const cards = s
    ? [
        { label: "Total supply", value: `${s.totalSupply} ${symbol}` },
        { label: "Holders", value: s.holderCount },
        { label: "Tokens issued", value: s.totalIssued },
        { label: "Tokens redeemed", value: s.totalRedeemed },
        { label: "Tokens transferred", value: s.totalTransferred },
        { label: "Transactions", value: s.transactionCount },
        { label: "Redemptions", value: s.redemptionCount },
        { label: "Latest block", value: s.blockNumber },
      ]
    : [];

  return (
    <>
      <section className="card">
        <h2>Statistics</h2>
        {stats.error && <p className="error-text">{stats.error}</p>}
        <div className="grid stats">
          {cards.map((c) => (
            <div key={c.label} className="stat">
              <div className="muted">{c.label}</div>
              <div className="big">{c.value}</div>
            </div>
          ))}
        </div>
        <p className="muted">
          Everything here is read from the blockchain. The holder balances are rebuilt only from{" "}
          <code>Transfer</code> events, and they always match <code>balanceOf()</code>.
        </p>
      </section>

      <div className="grid two wide-right">
        <section className="card">
          <h2>Holders</h2>
          <table>
            <tbody>
              {(holders.data ?? []).map((h) => (
                <tr key={h.address}>
                  <td>{displayAddress(h.address, knownAccounts)}</td>
                  <td className="num">{h.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {holders.data?.length === 0 && <p className="muted">Nobody holds tokens yet.</p>}
        </section>

        <section className="card">
          <div className="card-title">
            <h2>All transactions</h2>
            <select value={type} onChange={(e) => setType(e.target.value as ActivityType | "")}>
              <option value="">All types</option>
              <option value="award">Awards</option>
              <option value="transfer">Transfers</option>
              <option value="redeem">Redemptions</option>
              <option value="mint">Other mints</option>
              <option value="burn">Other burns</option>
            </select>
          </div>
          <TransactionTable activities={transactions.data ?? []} accounts={knownAccounts} />
        </section>
      </div>
    </>
  );
}
