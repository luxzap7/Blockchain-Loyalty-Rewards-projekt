# Part 3: Frontend (dApp)

A web app built with [React](https://react.dev) + [Vite](https://vite.dev) and [ethers.js](https://docs.ethers.org/v6/), with [MetaMask](https://metamask.io) as the wallet.

| Tab | Who | What |
|---|---|---|
| My wallet | Customer | Balance, send tokens, own history |
| Rewards | Customer | Reward catalog, redeem (approve + redeem), voucher number |
| Merchant | Merchant | Award tokens to customers |
| Admin | Admin | Add rewards, change price / stock / active |
| Explorer | Everyone | Statistics, token holders, all transactions |

**Reading** goes through the backend (Part 2). **Writing** (transactions) goes from MetaMask straight to the smart contracts (Part 1).

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (once) |
| `npm run dev` | Start the app on `http://localhost:5173` |
| `npm run build` | Type-check and build a production version into `dist/` |
| `npm run preview` | Serve the built version on `http://localhost:4173` |
| `npm run typecheck` | Check the TypeScript types |

The node, the deployment and the backend must be running (see the main [README](../README.md)).
`/api` requests are forwarded to the backend on port 3001 (see `vite.config.ts`).

## MetaMask setup (once)

1. Install the MetaMask extension. Use a **separate browser profile** or a MetaMask wallet without real money for this project.
2. Start the node (`npm run node` in `1-smart-contracts`). It prints 20 test accounts with their private keys.
3. In MetaMask, import accounts with **Import account** and the private key of:
   - Account #0: Admin
   - Account #1: Merchant
   - Account #2, #3 and #4: Alice, Bob and Carol (demo customers)
4. Open `http://localhost:5173`, click **Connect MetaMask**. If MetaMask is on another network, click
   **Wrong network: switch to Hardhat Local**. The app adds the network (RPC `http://127.0.0.1:8545`, chain id `31337`).

⚠️ The Hardhat test private keys are public. Never use these accounts on a real network.

**After restarting the node**, MetaMask still remembers old transactions and nonces. Reset it:
Settings → Advanced → **Clear activity tab data**. Otherwise you can get errors like "nonce too high".

## Source layout

```
src/
├── App.tsx              # layout, tabs, wallet state, runTx() for all transactions
├── api.ts               # backend calls + response types
├── wallet.ts            # MetaMask: connect, switch network, signer
├── actions.ts           # all transactions (transfer, redeem, award, add/update reward)
├── errors.ts            # decodes contract errors into readable messages
├── format.ts            # address and time formatting
├── useApi.ts            # React hook: load backend data, reload on refresh
├── styles.css
└── components/          # WalletBar, AddressInput, TransactionTable and the five tabs
```
