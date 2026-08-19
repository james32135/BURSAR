// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BursarVault} from "./BursarVault.sol";

/// @title BursarFactory
/// @notice Deploys one isolated BursarVault per workspace.
/// @dev Isolation is the contract instance. User A cannot pay, register,
///      mutate policy, or revoke sessions on User B's vault. Do not put
///      multiple owners inside a single BursarVault mapping.
contract BursarFactory {
    error Zero();
    error BadBands();

    event VaultCreated(
        address indexed owner,
        address indexed vault,
        address token,
        uint256 band0Max,
        uint256 band1Max
    );

    mapping(address => address[]) private _vaultsOf;
    mapping(address => bool) public isVault;

    function createVault(address token, uint256 band0Max, uint256 band1Max) external returns (address vault) {
        if (token == address(0)) revert Zero();
        if (band0Max == 0 || band1Max < band0Max) revert BadBands();
        BursarVault deployed = new BursarVault(token, msg.sender, band0Max, band1Max);
        vault = address(deployed);
        _vaultsOf[msg.sender].push(vault);
        isVault[vault] = true;
        emit VaultCreated(msg.sender, vault, token, band0Max, band1Max);
    }

    function vaultCount(address owner) external view returns (uint256) {
        return _vaultsOf[owner].length;
    }

    function vaultAt(address owner, uint256 index) external view returns (address) {
        return _vaultsOf[owner][index];
    }

    function vaultsOf(address owner) external view returns (address[] memory) {
        return _vaultsOf[owner];
    }
}
