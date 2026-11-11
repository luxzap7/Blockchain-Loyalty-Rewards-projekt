import { expect } from "chai";
import {
  connectAs,
  deployFixture,
  ethers,
  networkHelpers,
  TOKEN_NAME,
  TOKEN_SYMBOL,
} from "./helpers.js";

describe("LoyaltyToken", function () {
  describe("Deployment", function () {
    it("has the configured name and symbol, and 0 decimals", async function () {
      const { token } = await networkHelpers.loadFixture(deployFixture);

      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
      expect(await token.decimals()).to.equal(0n);
    });

    it("starts with zero supply", async function () {
      const { token } = await networkHelpers.loadFixture(deployFixture);

      expect(await token.totalSupply()).to.equal(0n);
    });

    it("makes the deployer the admin", async function () {
      const { token, admin } = await networkHelpers.loadFixture(deployFixture);

      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
    });
  });

  describe("Minting", function () {
    it("allows only MINTER_ROLE to mint", async function () {
      const { token, admin, alice } = await networkHelpers.loadFixture(deployFixture);
      const minterRole = await token.MINTER_ROLE();

      // Even the admin cannot mint directly; it does not have MINTER_ROLE.
      await expect(token.mint(alice.address, 100))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(admin.address, minterRole);
    });
  });

  describe("Transfers", function () {
    it("lets customers send tokens to each other", async function () {
      const { token, program, merchant, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await connectAs(program, merchant).awardTokens(alice.address, 100, "Purchase");

      await expect(connectAs(token, alice).transfer(bob.address, 30))
        .to.emit(token, "Transfer")
        .withArgs(alice.address, bob.address, 30);

      expect(await token.balanceOf(alice.address)).to.equal(70n);
      expect(await token.balanceOf(bob.address)).to.equal(30n);
    });

    it("rejects a transfer bigger than the balance", async function () {
      const { token, program, merchant, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await connectAs(program, merchant).awardTokens(alice.address, 100, "Purchase");

      await expect(connectAs(token, alice).transfer(bob.address, 101))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
        .withArgs(alice.address, 100, 101);
    });

    it("changes total supply only on mint and burn, not on transfer", async function () {
      const { token, program, merchant, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await connectAs(program, merchant).awardTokens(alice.address, 100, "Purchase");

      await connectAs(token, alice).transfer(bob.address, 40);

      expect(await token.totalSupply()).to.equal(100n);
    });
  });

  describe("Burning", function () {
    it("lets a holder burn their own tokens", async function () {
      const { token, program, merchant, alice } = await networkHelpers.loadFixture(deployFixture);
      await connectAs(program, merchant).awardTokens(alice.address, 100, "Purchase");

      await expect(connectAs(token, alice).burn(10))
        .to.emit(token, "Transfer")
        .withArgs(alice.address, ethers.ZeroAddress, 10);

      expect(await token.totalSupply()).to.equal(90n);
    });
  });
});
