// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BursarVault} from "../src/BursarVault.sol";

/// @notice Deploys a NEW production BursarVault. Never reuse spike vault addresses.
contract DeployBursarVault is Script {
    // $200 and $10,000 at USDC.e 6 decimals
    uint256 public constant BAND0 = 200 * 1e6;
    uint256 public constant BAND1 = 10_000 * 1e6;

    function run() external {
        address token = vm.envAddress("USDC_E_ADDRESS");
        address owner = vm.envAddress("BURSAR_OWNER_ADDRESS");
        uint256 pk = vm.envUint("BURSAR_DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(pk);
        BursarVault vault = new BursarVault(token, owner, BAND0, BAND1);
        vm.stopBroadcast();

        console2.log("BursarVault", address(vault));
        console2.log("token", token);
        console2.log("owner", owner);
        console2.log("band0Max", BAND0);
        console2.log("band1Max", BAND1);
    }
}
