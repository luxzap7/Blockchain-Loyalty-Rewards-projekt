import { useState } from "react";
import type { FormEvent } from "react";
import { isAddress } from "ethers";
import type { AppContext } from "../App";
import { awardTokens } from "../actions";
import { api } from "../api";
import { displayAddress } from "../format";
import { useApi } from "../useApi";
import AddressInput from "./AddressInput";
import TransactionTable from "./TransactionTable";

/** Merchant view: award tokens to customers. */
export default function MerchantTab({ ctx }: { ctx: AppContext }) {
  const { deployment, address, account, knownAccounts, refreshKey, runTx } = ctx;
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Purchase");
  const recentAwards = useApi(() => api.transactions({ type: "award", limit: 10 }), [refreshKey]);

  const value = Number(amount);
  const canAward = address !== null && isAddress(customer) && Number.isInteger(value) && value > 0;
  // Customers only: the admin and the merchant accounts are not offered in the list.
  const customers = knownAccounts.filter((a) => !a.isAdmin && !a.isMerchant);

  async function onAward(e: FormEvent) {
    e.preventDefault();
    const done = await runTx("Award tokens", async (signer) => {
      await awardTokens(deployment, signer, customer, value, reason);
      return `Awarded ${value} ${deployment.token.symbol} to ${displayAddress(customer, knownAccounts)}.`;
    });
    if (done) setAmount("");
  }

  return (
    <>
      <section className="card">
        <h2>Award tokens</h2>
        {address && account && !account.isMerchant && (
          <p className="notice">
            This account does not have <code>MERCHANT_ROLE</code>. You can still try: the smart contract will reject
            the transaction (<code>AccessControlUnauthorizedAccount</code>). Switch to the merchant account in
            MetaMask to award tokens.
          </p>
        )}
        <form className="form" onSubmit={onAward}>
          <label>
            Customer
            <AddressInput value={customer} onChange={setCustomer} accounts={customers} />
          </label>
          <label>
            Amount
            <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            Reason (stored in the event)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Purchase #1024 (25 EUR)" />
          </label>
          <button type="submit" disabled={!canAward}>
            Award
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Recent awards</h2>
        <TransactionTable activities={recentAwards.data ?? []} accounts={knownAccounts} empty="No awards yet." />
      </section>
    </>
  );
}
