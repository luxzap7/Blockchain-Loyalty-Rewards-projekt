import { useState } from "react";
import type { FormEvent } from "react";
import type { AppContext } from "../App";
import { addReward, updateReward } from "../actions";
import { api } from "../api";
import type { Reward } from "../api";
import { useApi } from "../useApi";

/** Admin view: add rewards and change price, stock or availability. */
export default function AdminTab({ ctx }: { ctx: AppContext }) {
  const { deployment, address, account, refreshKey, runTx } = ctx;
  const rewards = useApi(api.rewards, [refreshKey]);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");

  const canAdd = address !== null && name.trim() !== "" && Number(cost) > 0 && Number(stock) >= 0 && stock !== "";

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const done = await runTx("Add reward", async (signer) => {
      await addReward(deployment, signer, name.trim(), Number(cost), Number(stock));
      return `Added "${name.trim()}" to the catalog.`;
    });
    if (done) {
      setName("");
      setCost("");
      setStock("");
    }
  }

  return (
    <>
      {address && account && !account.isAdmin && (
        <p className="notice">
          This account is not the admin. You can still try: the smart contract will reject the transaction (
          <code>AccessControlUnauthorizedAccount</code>). Switch to the admin account (local account #0) in MetaMask.
        </p>
      )}

      <section className="card">
        <h2>Add a reward</h2>
        <form className="form inline" onSubmit={onAdd}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Free smoothie" />
          </label>
          <label>
            Cost ({deployment.token.symbol})
            <input type="number" min="1" step="1" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          <label>
            Stock
            <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
          <button type="submit" disabled={!canAdd}>
            Add
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Catalog</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">Id</th>
                <th>Name</th>
                <th>Cost</th>
                <th>Stock</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(rewards.data ?? []).map((reward) => (
                // The key changes when the values on the chain change, which resets the edit fields.
                <RewardRow
                  key={`${reward.id}-${reward.cost}-${reward.stock}-${reward.active}`}
                  reward={reward}
                  ctx={ctx}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function RewardRow({ reward, ctx }: { reward: Reward; ctx: AppContext }) {
  const [cost, setCost] = useState(String(reward.cost));
  const [stock, setStock] = useState(String(reward.stock));
  const [active, setActive] = useState(reward.active);

  const changed = Number(cost) !== reward.cost || Number(stock) !== reward.stock || active !== reward.active;
  const valid = Number(cost) > 0 && Number(stock) >= 0 && cost !== "" && stock !== "";

  async function onSave() {
    await ctx.runTx(`Update "${reward.name}"`, async (signer) => {
      await updateReward(ctx.deployment, signer, reward.id, Number(cost), Number(stock), active);
      return `Updated "${reward.name}".`;
    });
  }

  return (
    <tr>
      <td className="num">{reward.id}</td>
      <td>{reward.name}</td>
      <td>
        <input className="small" type="number" min="1" value={cost} onChange={(e) => setCost(e.target.value)} />
      </td>
      <td>
        <input className="small" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
      </td>
      <td>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </td>
      <td>
        <button disabled={!changed || !valid || !ctx.address} onClick={onSave}>
          Save
        </button>
      </td>
    </tr>
  );
}
