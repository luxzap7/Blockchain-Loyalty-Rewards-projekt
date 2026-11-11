// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title LoyaltyToken
/// @notice ERC-20 token that represents loyalty points. 1 token = 1 point.
/// @dev Balances, transfers and allowances come from the audited OpenZeppelin ERC20.
///      Only accounts with MINTER_ROLE (the LoyaltyProgram contract) can create new tokens.
contract LoyaltyToken is ERC20, ERC20Burnable, AccessControl {
    /// @notice Role that is allowed to mint (create) new tokens.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @param name_ Full token name, e.g. "Loyalty Token"
    /// @param symbol_ Short ticker, e.g. "LOYAL"
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        // The deployer becomes the admin and can grant MINTER_ROLE to the program contract.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Points are whole numbers, so the token has no decimal places.
    /// @dev Standard ERC-20 tokens use 18 decimals; 0 means a balance of 50 is exactly 50 points.
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Creates `amount` new tokens and gives them to `to`.
    /// @dev Emits the standard ERC-20 Transfer event with `from` = address(0).
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
