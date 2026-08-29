// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BursarAgentID} from "../src/BursarAgentID.sol";

/// @notice One-shot clerk identity. Does not deploy a new vault.
contract DeployBursarAgentID is Script {
    function run() external {
        uint256 pk = vm.envUint("BURSAR_DEPLOYER_PRIVATE_KEY");
        address owner = vm.envAddress("BURSAR_OWNER_ADDRESS");
        address vault = vm.envAddress("BURSAR_AGENT_VAULT");
        address sessionAgent = vm.envAddress("BURSAR_AGENT_SESSION");
        vm.startBroadcast(pk);
        BursarAgentID id = new BursarAgentID(owner, vault, sessionAgent);
        vm.stopBroadcast();
        console2.log("BursarAgentID", address(id));
        console2.log("ownerOf1", id.ownerOf(1));
        console2.log("vault", id.vault());
        console2.log("sessionAgent", id.sessionAgent());
    }
}
