import { expect } from "chai";
import {
  connectAs,
  deployFixture,
  ethers,
  networkHelpers,
  programWithRewardsFixture,
} from "./helpers.js";

describe("LoyaltyProgram", function () {
  describe("Deployment", function () {
    it("is linked to the token and can mint it", async function () {
      const { token, program } = await networkHelpers.loadFixture(deployFixture);

      expect(await program.token()).to.equal(await token.getAddress());
      expect(await token.hasRole(await token.MINTER_ROLE(), await program.getAddress())).to.equal(true);
    });

    it("gives the deployer the admin role and the merchant the merchant role", async function () {
      const { program, admin, merchant } = await networkHelpers.loadFixture(deployFixture);

      expect(await program.hasRole(await program.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await program.hasRole(await program.MERCHANT_ROLE(), merchant.address)).to.equal(true);
    });

    it("rejects the zero address as token", async function () {
      const factory = await ethers.getContractFactory("LoyaltyProgram");

      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        factory,
        "InvalidAddress",
      );
    });
  });

  describe("Awarding tokens", function () {
    it("lets a merchant award tokens to a customer", async function () {
      const { token, program, merchant, alice } = await networkHelpers.loadFixture(deployFixture);

      const tx = connectAs(program, merchant).awardTokens(alice.address, 100, "Purchase #1");

      await expect(tx)
        .to.emit(program, "TokensAwarded")
        .withArgs(alice.address, 100, "Purchase #1", merchant.address);
      // Minting is a Transfer from the zero address.
      await expect(tx).to.emit(token, "Transfer").withArgs(ethers.ZeroAddress, alice.address, 100);

      expect(await token.balanceOf(alice.address)).to.equal(100n);
      expect(await token.totalSupply()).to.equal(100n);
    });

    it("rejects awards from accounts without MERCHANT_ROLE", async function () {
      const { program, outsider, alice } = await networkHelpers.loadFixture(deployFixture);

      await expect(connectAs(program, outsider).awardTokens(alice.address, 100, "Fake"))
        .to.be.revertedWithCustomError(program, "AccessControlUnauthorizedAccount")
        .withArgs(outsider.address, await program.MERCHANT_ROLE());
    });

    it("rejects the zero address and a zero amount", async function () {
      const { program, merchant, alice } = await networkHelpers.loadFixture(deployFixture);
      const asMerchant = connectAs(program, merchant);

      await expect(asMerchant.awardTokens(ethers.ZeroAddress, 100, "x")).to.be.revertedWithCustomError(
        program,
        "InvalidAddress",
      );
      await expect(asMerchant.awardTokens(alice.address, 0, "x")).to.be.revertedWithCustomError(
        program,
        "InvalidAmount",
      );
    });

    it("lets the admin add and remove merchants", async function () {
      const { program, outsider, alice } = await networkHelpers.loadFixture(deployFixture);
      const merchantRole = await program.MERCHANT_ROLE();
      const asNewMerchant = connectAs(program, outsider);

      await program.grantRole(merchantRole, outsider.address);
      await expect(asNewMerchant.awardTokens(alice.address, 10, "Purchase")).to.emit(
        program,
        "TokensAwarded",
      );

      await program.revokeRole(merchantRole, outsider.address);
      await expect(asNewMerchant.awardTokens(alice.address, 10, "Purchase")).to.be.revertedWithCustomError(
        program,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  describe("Reward catalog", function () {
    it("lets the admin add a reward", async function () {
      const { program } = await networkHelpers.loadFixture(deployFixture);

      await expect(program.addReward("Free coffee", 50, 100))
        .to.emit(program, "RewardAdded")
        .withArgs(0, "Free coffee", 50, 100);

      const reward = await program.getReward(0);
      expect(reward.name).to.equal("Free coffee");
      expect(reward.cost).to.equal(50n);
      expect(reward.stock).to.equal(100n);
      expect(reward.active).to.equal(true);
      expect(await program.rewardCount()).to.equal(1n);
    });

    it("returns the whole catalog", async function () {
      const { program } = await networkHelpers.loadFixture(programWithRewardsFixture);

      const rewards = await program.getAllRewards();

      expect(rewards.length).to.equal(2);
      expect(rewards[0].name).to.equal("Free coffee");
      expect(rewards[1].name).to.equal("Branded mug");
    });

    it("rejects catalog changes from non-admins", async function () {
      const { program, merchant } = await networkHelpers.loadFixture(programWithRewardsFixture);
      const asMerchant = connectAs(program, merchant);
      const adminRole = await program.DEFAULT_ADMIN_ROLE();

      await expect(asMerchant.addReward("Free TV", 1, 1))
        .to.be.revertedWithCustomError(program, "AccessControlUnauthorizedAccount")
        .withArgs(merchant.address, adminRole);
      await expect(asMerchant.updateReward(0, 1, 1000, true))
        .to.be.revertedWithCustomError(program, "AccessControlUnauthorizedAccount")
        .withArgs(merchant.address, adminRole);
    });

    it("rejects an empty name and a zero cost", async function () {
      const { program } = await networkHelpers.loadFixture(programWithRewardsFixture);

      await expect(program.addReward("", 50, 1)).to.be.revertedWithCustomError(program, "EmptyName");
      await expect(program.addReward("Free coffee", 0, 1)).to.be.revertedWithCustomError(
        program,
        "InvalidAmount",
      );
      await expect(program.updateReward(0, 0, 1, true)).to.be.revertedWithCustomError(
        program,
        "InvalidAmount",
      );
    });

    it("lets the admin update price, stock and active flag", async function () {
      const { program } = await networkHelpers.loadFixture(programWithRewardsFixture);

      await expect(program.updateReward(0, 60, 5, false))
        .to.emit(program, "RewardUpdated")
        .withArgs(0, 60, 5, false);

      const reward = await program.getReward(0);
      expect(reward.cost).to.equal(60n);
      expect(reward.stock).to.equal(5n);
      expect(reward.active).to.equal(false);
    });

    it("rejects unknown reward ids", async function () {
      const { program } = await networkHelpers.loadFixture(programWithRewardsFixture);

      await expect(program.getReward(99))
        .to.be.revertedWithCustomError(program, "RewardNotFound")
        .withArgs(99);
      await expect(program.updateReward(99, 1, 1, true))
        .to.be.revertedWithCustomError(program, "RewardNotFound")
        .withArgs(99);
    });
  });

  describe("Redeeming rewards", function () {
    it("burns the tokens, lowers the stock and emits RewardRedeemed", async function () {
      const { token, program, alice } = await networkHelpers.loadFixture(programWithRewardsFixture);
      const programAddress = await program.getAddress();

      // Step 1: Alice allows the program to spend 50 of her tokens.
      await connectAs(token, alice).approve(programAddress, 50);
      // Step 2: Alice redeems reward 0 ("Free coffee", cost 50).
      const tx = connectAs(program, alice).redeem(0);

      await expect(tx).to.emit(program, "RewardRedeemed").withArgs(1, alice.address, 0, 50);
      // Burning is a Transfer to the zero address.
      await expect(tx).to.emit(token, "Transfer").withArgs(alice.address, ethers.ZeroAddress, 50);

      expect(await token.balanceOf(alice.address)).to.equal(150n);
      expect(await token.totalSupply()).to.equal(150n);
      expect((await program.getReward(0)).stock).to.equal(1n);
      expect(await program.redemptionCount()).to.equal(1n);
      // The allowance is used up.
      expect(await token.allowance(alice.address, programAddress)).to.equal(0n);
    });

    it("gives every redemption a new id", async function () {
      const { token, program, alice } = await networkHelpers.loadFixture(programWithRewardsFixture);
      await connectAs(token, alice).approve(await program.getAddress(), 100);
      const asAlice = connectAs(program, alice);

      await expect(asAlice.redeem(0)).to.emit(program, "RewardRedeemed").withArgs(1, alice.address, 0, 50);
      await expect(asAlice.redeem(0)).to.emit(program, "RewardRedeemed").withArgs(2, alice.address, 0, 50);
    });

    it("fails without an approve, and changes nothing", async function () {
      const { token, program, alice } = await networkHelpers.loadFixture(programWithRewardsFixture);

      await expect(connectAs(program, alice).redeem(0))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance")
        .withArgs(await program.getAddress(), 0, 50);

      // The whole transaction was reverted, including the stock change.
      expect((await program.getReward(0)).stock).to.equal(2n);
      expect(await program.redemptionCount()).to.equal(0n);
      expect(await token.balanceOf(alice.address)).to.equal(200n);
    });

    it("fails when the customer does not have enough tokens", async function () {
      const { token, program, alice } = await networkHelpers.loadFixture(programWithRewardsFixture);
      await connectAs(token, alice).approve(await program.getAddress(), 300);

      // Alice has 200, the mug costs 300.
      await expect(connectAs(program, alice).redeem(1))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
        .withArgs(alice.address, 200, 300);
    });

    it("fails for an inactive reward", async function () {
      const { token, program, alice } = await networkHelpers.loadFixture(programWithRewardsFixture);
      await connectAs(token, alice).approve(await program.getAddress(), 50);
      await program.updateReward(0, 50, 2, false);

      await expect(connectAs(program, alice).redeem(0))
        .to.be.revertedWithCustomError(program, "RewardInactive")
        .withArgs(0);
    });

    it("fails when the reward is out of stock", async function () {
      const { token, program, alice } = await networkHelpers.loadFixture(programWithRewardsFixture);
      await connectAs(token, alice).approve(await program.getAddress(), 150);
      const asAlice = connectAs(program, alice);

      // Stock is 2: two redemptions work, the third one fails.
      await asAlice.redeem(0);
      await asAlice.redeem(0);
      await expect(asAlice.redeem(0)).to.be.revertedWithCustomError(program, "RewardOutOfStock").withArgs(0);
    });

    it("fails for an unknown reward id", async function () {
      const { program, alice } = await networkHelpers.loadFixture(programWithRewardsFixture);

      await expect(connectAs(program, alice).redeem(5))
        .to.be.revertedWithCustomError(program, "RewardNotFound")
        .withArgs(5);
    });
  });

  describe("Full customer journey", function () {
    it("award -> transfer -> redeem, and the history can be read back from events", async function () {
      const { token, program, merchant, alice, bob } = await networkHelpers.loadFixture(programWithRewardsFixture);
      const startBlock = await ethers.provider.getBlockNumber();

      // Alice buys something and gets 100 more tokens (she had 200).
      await connectAs(program, merchant).awardTokens(alice.address, 100, "Purchase #42");
      // Alice sends 50 tokens to her friend Bob.
      await connectAs(token, alice).transfer(bob.address, 50);
      // Bob uses them for a free coffee.
      await connectAs(token, bob).approve(await program.getAddress(), 50);
      await connectAs(program, bob).redeem(0);

      expect(await token.balanceOf(alice.address)).to.equal(250n);
      expect(await token.balanceOf(bob.address)).to.equal(0n);
      expect(await token.totalSupply()).to.equal(250n);

      // Everything that happened is stored on-chain as events.
      const awards = await program.queryFilter(program.filters.TokensAwarded(), startBlock + 1);
      const redemptions = await program.queryFilter(program.filters.RewardRedeemed(), startBlock + 1);
      const bobTransfers = await token.queryFilter(token.filters.Transfer(null, bob.address), startBlock + 1);

      expect(awards.length).to.equal(1);
      expect(redemptions.length).to.equal(1);
      expect(bobTransfers.length).to.equal(1);
    });
  });
});
