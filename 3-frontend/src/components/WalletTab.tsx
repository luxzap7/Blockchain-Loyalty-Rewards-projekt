import { useState } from "react";
import type { FormEvent } from "react";
import { isAddress } from "ethers";
import type { AppContext } from "../App";
import { transferTokens } from "../actions";
import { api } from "../api";
import { displayAddress } from "../format";
import { useApi } from "../useApi";
import AddressInput from "./AddressInput";
import TransactionTable from "./TransactionTable";

/** Customer view: own balance, sending tokens, own history. */
export default function WalletTab({ ctx }: { ctx: AppContext }) {
  const { deployment, address, account, knownAccounts, refreshKey, runTx } = ctx;
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const history = useApi(
    () => (address ? api.transactions({ address }) : Promise.resolve([])),
    [address, refreshKey],
  );

  if (!address) {
    return (
      <section className="card">
        <h2>My wallet</h2>
        <p>Connect MetaMask to see your tokens.</p>
        <p className="muted">
          Tip: import the local test accounts into MetaMask (their private keys are printed by <code>npm run node</code>
          ). Account #0 is the admin, #1 the merchant, #2 to #4 are the demo customers Alice, Bob and Carol.
        </p>
      </section>
    );
  }

  const value = Number(amount);
  const canSend = isAddress(to) && Number.isInteger(value) && value > 0;

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const sent = await runTx("Transfer", async (signer) => {
      await transferTokens(deployment, signer, to, value);
      return `Sent ${value} ${deployment.token.symbol} to ${displayAddress(to, knownAccounts)}.`;
    });
    if (sent) setAmount("");
  }

  return (
    <>
      <div className="grid two">
        <section className="card">
          <h2>My balance</h2>
          <p className="big">
            {account?.balance ?? "..."} <span className="muted">{deployment.token.symbol}</span>
          </p>
          <p className="muted">
            Read live from the token contract with <code>balanceOf()</code>.
          </p>
        </section>

        <section className="card">
          <h2>Send tokens</h2>
          <form className="form" onSubmit={onSend}>
            <label>
              To
              <AddressInput value={to} onChange={setTo} accounts={knownAccounts} exclude={address} />
            </label>
            <label>
              Amount
              <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <button type="submit" disabled={!canSend}>
              Send
            </button>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>My history</h2>
        {history.error ? (
          <p className="error-text">{history.error}</p>
        ) : (
          <TransactionTable activities={history.data ?? []} accounts={knownAccounts} />
        )}
      </section>
    </>
  );
}
