# Part 2: Backend (tracking + REST API)

A small [Express](https://expressjs.com) server that **reads** the blockchain and offers the data as a REST API:
balances, the reward catalog, statistics, and the full transaction history rebuilt from contract events.
It also prints every new event in the terminal (live tracking), and has a seed script that creates demo activity.

The backend has **no database** and **cannot change anything** on the blockchain. All data comes from the contracts of Part 1.

## Folder layout

```
2-backend/
├── src/
│   ├── server.ts     # REST API + starts live tracking
│   ├── history.ts    # events -> transaction history, balances, totals
│   ├── chain.ts      # connection to the node and the contracts
│   ├── accounts.ts   # names for known local accounts (Admin, Merchant, Alice, ...)
│   ├── live.ts       # prints new events in the terminal
│   ├── seed.ts       # creates demo activity
│   └── config.ts     # settings (port, RPC URL, file paths)
├── config/
│   └── demo.json     # demo customers and seed steps (edit to change the demo)
└── test/
    └── history.test.ts
```

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (once) |
| `npm start` | Start the API on `http://localhost:3001/api` |
| `npm run seed` | Create demo activity (awards, a transfer, redemptions) |
| `npm test` | Run the unit tests |
| `npm run typecheck` | Check the TypeScript types |

Before `npm start` or `npm run seed`, the local node must be running and the contracts deployed
(in `1-smart-contracts`: `npm run node` and `npm run deploy:local`).

Node.js runs the `.ts` files directly (Node 23.6+ strips the types), so there is no build step.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | Is the blockchain reachable, current block |
| `GET /api/deployment` | Contract addresses + ABIs, token name/symbol (used by the frontend) |
| `GET /api/stats` | Total supply, issued/redeemed/transferred totals, counts |
| `GET /api/rewards` | Reward catalog |
| `GET /api/accounts` | Known local accounts with balance and roles |
| `GET /api/accounts/:address` | Balance and roles of any address |
| `GET /api/holders` | All token holders, rebuilt from `Transfer` events |
| `GET /api/transactions` | Full history, newest first. Optional `?type=award\|transfer\|redeem\|mint\|burn` and `?limit=N` |
| `GET /api/transactions/:address` | History of one address (same options) |

Example: `curl http://localhost:3001/api/transactions?type=redeem&limit=5`

## Settings

Environment variables (all optional): `PORT` (default `3001`), `RPC_URL` (default `http://localhost:8545`),
`DEPLOYMENT_FILE` (default `../1-smart-contracts/deployments/localhost.json`).

If the node is restarted, deploy again and then restart the backend.
