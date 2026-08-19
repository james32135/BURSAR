// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BursarFactory} from "../src/BursarFactory.sol";
import {BursarVault} from "../src/BursarVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract BursarFactoryTest is Test {
    BursarFactory factory;
    MockERC20 token;

    address ownerA = makeAddr("ownerA");
    address ownerB = makeAddr("ownerB");
    address agentA = makeAddr("agentA");
    address agentB = makeAddr("agentB");
    address vendorA = makeAddr("vendorA");
    address vendorB = makeAddr("vendorB");

    uint256 constant BAND0 = 10_000;
    uint256 constant BAND1 = 50_000;
    bytes32 constant ROOT = bytes32(uint256(0xA1));
    bytes32 constant RESP = bytes32(uint256(0xB1));
    address constant SIGNER = address(0x8561E0a9dA3C8d6591A2E756a91334f1a3E537e0);

    function setUp() public {
        token = new MockERC20();
        factory = new BursarFactory();
    }

    function test_createVault_ownerIsCaller() public {
        vm.prank(ownerA);
        address vault = factory.createVault(address(token), BAND0, BAND1);
        assertEq(BursarVault(vault).owner(), ownerA);
        assertEq(address(BursarVault(vault).token()), address(token));
        assertTrue(factory.isVault(vault));
        assertEq(factory.vaultCount(ownerA), 1);
        assertEq(factory.vaultAt(ownerA, 0), vault);
    }

    function test_twoOwners_isolatedVaults() public {
        vm.prank(ownerA);
        address vaultA = factory.createVault(address(token), BAND0, BAND1);
        vm.prank(ownerB);
        address vaultB = factory.createVault(address(token), BAND0, BAND1);
        assertTrue(vaultA != vaultB);
        assertEq(BursarVault(vaultA).owner(), ownerA);
        assertEq(BursarVault(vaultB).owner(), ownerB);
        assertEq(factory.vaultCount(ownerA), 1);
        assertEq(factory.vaultCount(ownerB), 1);
    }

    function test_ownerA_cannotSetVendorOnB() public {
        vm.prank(ownerA);
        address vaultA = factory.createVault(address(token), BAND0, BAND1);
        vm.prank(ownerB);
        address vaultB = factory.createVault(address(token), BAND0, BAND1);
        vm.prank(ownerA);
        BursarVault(vaultA).setVendor(vendorA, true);
        vm.prank(ownerA);
        vm.expectRevert(BursarVault.NotOwner.selector);
        BursarVault(vaultB).setVendor(vendorA, true);
        assertFalse(BursarVault(vaultB).vendorAllowed(vendorA));
        assertTrue(BursarVault(vaultA).vendorAllowed(vendorA));
    }

    function test_ownerA_cannotPauseOrRevokeB() public {
        vm.prank(ownerB);
        address vaultB = factory.createVault(address(token), BAND0, BAND1);
        vm.prank(ownerB);
        BursarVault(vaultB).createSession(keccak256("b"), agentB, 20_000, uint64(block.timestamp + 30 days));
        vm.prank(ownerA);
        vm.expectRevert(BursarVault.NotOwner.selector);
        BursarVault(vaultB).setPaused(true);
        vm.prank(ownerA);
        vm.expectRevert(BursarVault.NotOwner.selector);
        BursarVault(vaultB).revokeSession(keccak256("b"));
    }

    function test_agentA_cannotPayVaultB() public {
        vm.prank(ownerA);
        address vaultA = factory.createVault(address(token), BAND0, BAND1);
        vm.prank(ownerB);
        address vaultB = factory.createVault(address(token), BAND0, BAND1);

        token.mint(vaultA, 100_000);
        token.mint(vaultB, 100_000);

        bytes32 inv = keccak256("invoice-b");
        vm.startPrank(ownerB);
        BursarVault(vaultB).setVendor(vendorB, true);
        BursarVault(vaultB).createSession(keccak256("b"), agentB, 20_000, uint64(block.timestamp + 30 days));
        vm.stopPrank();

        vm.prank(agentB);
        BursarVault(vaultB).registerInvoice(keccak256("b"), inv, ROOT);

        vm.prank(agentA);
        vm.expectRevert(BursarVault.NotAgent.selector);
        BursarVault(vaultB).pay(keccak256("b"), vendorB, 1_000, inv, ROOT, RESP, SIGNER);

        vm.prank(agentB);
        BursarVault(vaultB).pay(keccak256("b"), vendorB, 1_000, inv, ROOT, RESP, SIGNER);
        assertEq(token.balanceOf(vendorB), 1_000);
        assertEq(token.balanceOf(vaultA), 100_000);
    }

    function test_sameInvoiceHash_canExistOnBothVaults() public {
        vm.prank(ownerA);
        address vaultA = factory.createVault(address(token), BAND0, BAND1);
        vm.prank(ownerB);
        address vaultB = factory.createVault(address(token), BAND0, BAND1);
        token.mint(vaultA, 50_000);
        token.mint(vaultB, 50_000);
        bytes32 inv = keccak256("shared-pdf");

        vm.startPrank(ownerA);
        BursarVault(vaultA).setVendor(vendorA, true);
        BursarVault(vaultA).createSession(keccak256("a"), agentA, 20_000, uint64(block.timestamp + 30 days));
        vm.stopPrank();
        vm.startPrank(ownerB);
        BursarVault(vaultB).setVendor(vendorB, true);
        BursarVault(vaultB).createSession(keccak256("b"), agentB, 20_000, uint64(block.timestamp + 30 days));
        vm.stopPrank();

        vm.prank(agentA);
        BursarVault(vaultA).registerInvoice(keccak256("a"), inv, ROOT);
        vm.prank(agentB);
        BursarVault(vaultB).registerInvoice(keccak256("b"), inv, ROOT);

        vm.prank(agentA);
        BursarVault(vaultA).pay(keccak256("a"), vendorA, 500, inv, ROOT, RESP, SIGNER);
        vm.prank(agentB);
        BursarVault(vaultB).pay(keccak256("b"), vendorB, 700, inv, ROOT, RESP, SIGNER);

        assertEq(token.balanceOf(vendorA), 500);
        assertEq(token.balanceOf(vendorB), 700);
        (, uint256 amtA, , , , , , ) = BursarVault(vaultA).payments(inv);
        (, uint256 amtB, , , , , , ) = BursarVault(vaultB).payments(inv);
        assertEq(amtA, 500);
        assertEq(amtB, 700);
    }

    function test_revertsZeroTokenAndBadBands() public {
        vm.prank(ownerA);
        vm.expectRevert(BursarFactory.Zero.selector);
        factory.createVault(address(0), BAND0, BAND1);
        vm.prank(ownerA);
        vm.expectRevert(BursarFactory.BadBands.selector);
        factory.createVault(address(token), 0, BAND1);
        vm.prank(ownerA);
        vm.expectRevert(BursarFactory.BadBands.selector);
        factory.createVault(address(token), BAND1, BAND0);
    }
}
