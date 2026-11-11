import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [
    hardhatEthers, // ethers.js inside Hardhat (contracts, signers, provider)
    hardhatEthersChaiMatchers, // test assertions like .to.emit() and .to.be.revertedWithCustomError()
    hardhatMocha, // runs the tests in test/ with Mocha
    hardhatNetworkHelpers, // test helpers like loadFixture()
  ],
  solidity: {
    version: "0.8.34",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  // No custom networks: the project only runs locally.
  // - "default": in-memory chain created for each test run / script
  // - "localhost": the node started with `npm run node` (http://localhost:8545, chainId 31337)
});
