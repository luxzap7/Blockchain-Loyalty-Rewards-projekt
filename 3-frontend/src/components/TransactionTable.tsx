import type { Account, Activity, ActivityType } from "../api";
import { displayAddress, formatTime } from "../format";

const TYPE_LABELS: Record<ActivityType, string> = {
  award: "Award",
  transfer: "Transfer",
  redeem: "Redeem",
  mint: "Mint",
  burn: "Burn",
};

interface Props {
  activities: Activity[];
  accounts: Account[];
  empty?: string;
}

/** Transaction history as a table (data comes from the backend, which reads the contract events). */
export default function TransactionTable({ activities, accounts, empty = "No transactions yet." }: Props) {
  if (activities.length === 0) return <p className="muted">{empty}</p>;

  function details(a: Activity): string {
    if (a.type === "award" && a.merchant) return `${a.details} (by ${displayAddress(a.merchant, accounts)})`;
    if (a.type === "redeem") return `${a.details} · voucher #${a.redemptionId}`;
    return a.details;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>From</th>
            <th>To</th>
            <th className="num">Amount</th>
            <th>Details</th>
            <th className="num">Block</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => (
            <tr key={`${a.txHash}-${a.logIndex}`}>
              <td>{formatTime(a.timestamp)}</td>
              <td>
                <span className={`badge ${a.type}`}>{TYPE_LABELS[a.type]}</span>
              </td>
              <td>{a.from ? displayAddress(a.from, accounts) : <span className="muted">new tokens</span>}</td>
              <td>{a.to ? displayAddress(a.to, accounts) : <span className="muted">burned</span>}</td>
              <td className="num">{a.amount}</td>
              <td>{details(a)}</td>
              <td className="num" title={a.txHash}>
                {a.blockNumber}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
