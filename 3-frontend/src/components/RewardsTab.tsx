import { useState } from "react";
import type { AppContext } from "../App";
import { redeemReward } from "../actions";
import { api } from "../api";
import type { Reward } from "../api";
import { useApi } from "../useApi";

/** Customer view: the reward catalog and redeeming. */
export default function RewardsTab({ ctx }: { ctx: AppContext }) {
  const { deployment, address, account, refreshKey, runTx } = ctx;
  const rewards = useApi(api.rewards, [refreshKey]);
  const [voucher, setVoucher] = useState<{ id: number | null; reward: string } | null>(null);
  const symbol = deployment.token.symbol;
  const balance = account?.balance ?? 0;

  async function onRedeem(reward: Reward) {
    await runTx(`Redeem "${reward.name}"`, async (signer, progress) => {
      const id = await redeemReward(deployment, signer, reward.id, reward.cost, progress);
      setVoucher({ id, reward: reward.name });
      return `Redeemed "${reward.name}" for ${reward.cost} ${symbol}. Voucher #${id}.`;
    });
  }

  /** Why the button is disabled, or null if the reward can be redeemed. */
  function blockedReason(reward: Reward): string | null {
    if (!address) return "Connect MetaMask";
    if (!reward.active) return "Not available";
    if (reward.stock === 0) return "Out of stock";
    if (balance < reward.cost) return `You need ${reward.cost - balance} more`;
    return null;
  }

  return (
    <>
      {voucher && (
        <section className="card voucher">
          <h2>Voucher #{voucher.id}</h2>
          <p>
            <strong>{voucher.reward}</strong>: show this number at the counter. It is stored on the blockchain in the{" "}
            <code>RewardRedeemed</code> event.
          </p>
        </section>
      )}

      <section className="card">
        <h2>Rewards</h2>
        <p className="muted">
          Redeeming needs two MetaMask confirmations: <code>approve</code> (allow the program to spend your tokens) and{" "}
          <code>redeem</code> (the program burns them). If you already approved enough, the first step is skipped.
        </p>
        {rewards.error && <p className="error-text">{rewards.error}</p>}
        <div className="grid rewards">
          {(rewards.data ?? []).map((reward) => {
            const blocked = blockedReason(reward);
            return (
              <div key={reward.id} className={reward.active ? "reward" : "reward inactive"}>
                <h3>{reward.name}</h3>
                <p className="big">
                  {reward.cost} <span className="muted">{symbol}</span>
                </p>
                <p className="muted">
                  {reward.stock} left{reward.active ? "" : " · inactive"}
                </p>
                <button disabled={blocked !== null} onClick={() => onRedeem(reward)}>
                  {blocked ?? "Redeem"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
