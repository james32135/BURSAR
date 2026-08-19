// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BursarFactory} from "../src/BursarFactory.sol";

contract DeployBursarFactory is Script {
    function run() external {
        uint256 pk = vm.envUint("BURSAR_DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        BursarFactory factory = new BursarFactory();
        vm.stopBroadcast();
        console2.log("BursarFactory", address(factory));
    }
}
