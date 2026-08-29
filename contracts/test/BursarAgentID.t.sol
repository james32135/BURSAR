// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BursarAgentID} from "../src/BursarAgentID.sol";

contract BursarAgentIDTest is Test {
    BursarAgentID id;
    address owner = address(0xA11CE);
    address vault = address(0xB0B);
    address agent = address(0xC0DE);

    function setUp() public {
        vm.prank(owner);
        id = new BursarAgentID(owner, vault, agent);
    }

    function test_production_interface_ids() public view {
        assertTrue(id.supportsInterface(0x01ffc9a7), "ERC165");
        assertTrue(id.supportsInterface(0x80ac58cd), "ERC721");
        assertTrue(id.supportsInterface(0x2afbede9), "IERC7857");
        assertTrue(id.supportsInterface(0xdf597d99), "Authorize");
        assertTrue(id.supportsInterface(0x74f8628b), "Cloneable");
        assertFalse(id.supportsInterface(0xffffffff));
        assertFalse(id.supportsInterface(0x4b396f04), "not Knole custom");
    }

    function test_mint_binds_owner_vault_agent() public view {
        assertEq(id.ownerOf(1), owner);
        assertEq(id.vault(), vault);
        assertEq(id.sessionAgent(), agent);
        assertEq(id.totalSupply(), 1);
        assertEq(id.balanceOf(owner), 1);
        address[] memory auth = id.authorizedUsersOf(1);
        assertEq(auth.length, 1);
        assertEq(auth[0], agent);
        BursarAgentID.IntelligentData[] memory data = id.intelligentDatasOf(1);
        assertEq(data.length, 1);
        assertEq(data[0].dataHash, keccak256(abi.encode(vault, agent)));
    }

    function test_transferFrom_reverts() public {
        vm.expectRevert(BursarAgentID.ERC7857UseITransferFrom.selector);
        id.transferFrom(owner, address(1), 1);
        vm.expectRevert(BursarAgentID.ERC7857UseITransferFrom.selector);
        id.safeTransferFrom(owner, address(1), 1);
    }

    function test_iTransfer_and_iClone_revert_no_mainnet_attestor() public {
        vm.expectRevert(BursarAgentID.NoMainnetAttestor.selector);
        id.iTransferFrom(owner, address(1), 1, "");
        vm.expectRevert(BursarAgentID.NoMainnetAttestor.selector);
        id.iCloneFrom(owner, address(1), 1, "");
    }

    function test_authorize_owner_only() public {
        address extra = address(0xEE);
        vm.prank(agent);
        vm.expectRevert(BursarAgentID.NotOwner.selector);
        id.authorizeUsage(1, extra);
        vm.prank(owner);
        id.authorizeUsage(1, extra);
        address[] memory auth = id.authorizedUsersOf(1);
        assertEq(auth.length, 2);
        assertEq(auth[1], extra);
        vm.prank(owner);
        id.revokeAuthorization(1, extra);
        assertEq(id.authorizedUsersOf(1).length, 1);
    }
}
