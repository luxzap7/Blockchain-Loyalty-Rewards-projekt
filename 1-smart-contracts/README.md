# Part 1: Smart contracts

Solidity contracts of the loyalty program, built with [Hardhat 3](https://hardhat.org) and [OpenZeppelin Contracts 5](https://docs.openzeppelin.com/contracts/5.x/).

- `LoyaltyToken`: ERC-20 token used as loyalty points (0 decimals, only the program can mint).
- `LoyaltyProgram`: awarding tokens, the reward catalog, and redeeming rewards.

## Folder layout

```
1-smart-contracts/
├── contracts/
│   ├── LoyaltyToken.sol      # ERC-20 token
│   └── LoyaltyProgram.sol    # program logic
├── test/
│   ├── helpers.ts            # shared setup (fixtures)
│   ├── LoyaltyToken.ts       # token tests
│   └── LoyaltyProgram.ts     # program tests
├── scripts/
│   └── deploy.ts             # deploys and configures everything
├── config/
│   └── program.json          # token name/symbol + reward catalog (edit this to change the scenario)
├── deployments/              # created by the deploy script (addresses + ABIs), not committed
└── hardhat.config.ts
```

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (once) |
| `npm run compile` | Compile the contracts |
| `npm test` | Run all tests |
| `npm run coverage` | Run tests and show code coverage |
| `npx hardhat test --gas-stats` | Run tests and show gas used per function |
| `npm run typecheck` | Check the TypeScript files for type errors |
| `npm run node` | Start a local blockchain on `http://localhost:8545` (chainId 31337) |
| `npm run deploy:local` | Deploy to the running local node and write `deployments/localhost.json` |

`npm run deploy:local` needs `npm run node` running in another terminal. The local node keeps its state only while it runs. After a restart, deploy again.

## Changing the scenario

Edit `config/program.json` and deploy again. You can change:
- the token name and symbol
- the list of rewards (name, cost in tokens, stock)

No Solidity changes are needed.
