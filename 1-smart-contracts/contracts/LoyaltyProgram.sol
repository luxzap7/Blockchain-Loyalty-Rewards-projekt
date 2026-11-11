// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {LoyaltyToken} from "./LoyaltyToken.sol";

/// @title LoyaltyProgram
/// @notice Business logic of the loyalty program: merchants award tokens to customers,
///         the admin manages a catalog of rewards, and customers redeem tokens for rewards.
/// @dev This contract must hold LoyaltyToken.MINTER_ROLE to be able to award tokens.
contract LoyaltyProgram is AccessControl {
    /// @notice Role for merchants (shops / cashiers) that are allowed to award tokens.
    bytes32 public constant MERCHANT_ROLE = keccak256("MERCHANT_ROLE");

    struct Reward {
        string name;
        uint256 cost; // price in tokens
        uint256 stock; // how many are still available
        bool active; // inactive rewards cannot be redeemed
    }

    /// @notice The ERC-20 token used as loyalty points.
    LoyaltyToken public immutable token;

    /// @notice Total number of redemptions so far. Also used as the next redemption id.
    uint256 public redemptionCount;

    // Reward id = index in this array.
    Reward[] private _rewards;

    event TokensAwarded(address indexed customer, uint256 amount, string reason, address indexed merchant);
    event RewardAdded(uint256 indexed rewardId, string name, uint256 cost, uint256 stock);
    event RewardUpdated(uint256 indexed rewardId, uint256 cost, uint256 stock, bool active);
    event RewardRedeemed(
        uint256 indexed redemptionId,
        address indexed customer,
        uint256 indexed rewardId,
        uint256 cost
    );

    error InvalidAddress();
    error InvalidAmount();
    error EmptyName();
    error RewardNotFound(uint256 rewardId);
    error RewardInactive(uint256 rewardId);
    error RewardOutOfStock(uint256 rewardId);

    constructor(LoyaltyToken token_) {
        if (address(token_) == address(0)) revert InvalidAddress();
        token = token_;
        // The deployer becomes the admin. Merchants are added later with grantRole(MERCHANT_ROLE, ...).
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Merchant: award tokens
    // ---------------------------------------------------------------------

    /// @notice Gives `amount` new tokens to `customer`, e.g. after a purchase.
    /// @param reason Free text stored in the event, e.g. "Purchase #1024 (25 EUR)".
    function awardTokens(address customer, uint256 amount, string calldata reason)
        external
        onlyRole(MERCHANT_ROLE)
    {
        if (customer == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        token.mint(customer, amount);
        emit TokensAwarded(customer, amount, reason, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Admin: manage the reward catalog
    // ---------------------------------------------------------------------

    /// @notice Adds a new reward to the catalog. New rewards are active right away.
    /// @return rewardId Id of the new reward (its index in the catalog).
    function addReward(string calldata name, uint256 cost, uint256 stock)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256 rewardId)
    {
        if (bytes(name).length == 0) revert EmptyName();
        if (cost == 0) revert InvalidAmount();

        rewardId = _rewards.length;
        _rewards.push(Reward({name: name, cost: cost, stock: stock, active: true}));
        emit RewardAdded(rewardId, name, cost, stock);
    }

    /// @notice Changes the price, stock or active flag of an existing reward.
    function updateReward(uint256 rewardId, uint256 cost, uint256 stock, bool active)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (cost == 0) revert InvalidAmount();
        Reward storage reward = _getReward(rewardId);

        reward.cost = cost;
        reward.stock = stock;
        reward.active = active;
        emit RewardUpdated(rewardId, cost, stock, active);
    }

    // ---------------------------------------------------------------------
    // Customer: redeem tokens for a reward
    // ---------------------------------------------------------------------

    /// @notice Spends (burns) the caller's tokens to get a reward.
    /// @dev The caller must first call token.approve(programAddress, cost), because this
    ///      contract burns the tokens with burnFrom(), which needs an allowance.
    /// @return redemptionId Unique id of this redemption (the "voucher number").
    function redeem(uint256 rewardId) external returns (uint256 redemptionId) {
        // 1. Checks
        Reward storage reward = _getReward(rewardId);
        if (!reward.active) revert RewardInactive(rewardId);
        if (reward.stock == 0) revert RewardOutOfStock(rewardId);

        // 2. Effects (update our own state before calling another contract)
        reward.stock -= 1;
        redemptionCount += 1;
        redemptionId = redemptionCount;
        uint256 cost = reward.cost;

        // 3. Interaction: reverts if the allowance or the balance is too low,
        //    which also undoes the effects above.
        token.burnFrom(msg.sender, cost);

        emit RewardRedeemed(redemptionId, msg.sender, rewardId, cost);
    }

    // ---------------------------------------------------------------------
    // Read-only helpers (free to call, no transaction needed)
    // ---------------------------------------------------------------------

    function rewardCount() external view returns (uint256) {
        return _rewards.length;
    }

    function getReward(uint256 rewardId) external view returns (Reward memory) {
        return _getReward(rewardId);
    }

    /// @notice Returns the whole catalog. Fine for a small catalog like in this project.
    function getAllRewards() external view returns (Reward[] memory) {
        return _rewards;
    }

    function _getReward(uint256 rewardId) private view returns (Reward storage) {
        if (rewardId >= _rewards.length) revert RewardNotFound(rewardId);
        return _rewards[rewardId];
    }
}
