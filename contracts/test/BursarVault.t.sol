// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BursarVault} from "../src/BursarVault.sol";
import {MockERC20, MockERC20FalseReturn} from "./mocks/MockERC20.sol";

contract BursarVaultTest is Test {
    BursarVault vault;
    BursarVault vault2;
    MockERC20 token;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address attacker = makeAddr("attacker");
    address vendorOk = makeAddr("vendorOk");
    address vendorBad = makeAddr("vendorBad");
    address remittance = makeAddr("remittance");

    bytes32 sessionAllow = keccak256("allow");
    bytes32 sessionExpired = keccak256("expired");
    bytes32 sessionRevoke = keccak256("revoke");
    bytes32 sessionOther = keccak256("other");

    uint256 constant BAND0 = 10_000;
    uint256 constant BAND1 = 50_000;
    uint256 constant SESSION_CAP = 20_000;
    uint256 constant FUND = 100_000;

    bytes32 constant ROOT_A = bytes32(uint256(0xA1));
    bytes32 constant RESP_A = bytes32(uint256(0xB1));
    address constant SIGNER = address(0x8561E0a9dA3C8d6591A2E756a91334f1a3E537e0);

    function setUp() public {
        token = new MockERC20();
        vault = new BursarVault(address(token), owner, BAND0, BAND1);
        vault2 = new BursarVault(address(token), owner, BAND0, BAND1);
        token.mint(address(vault), FUND);
        token.mint(address(vault2), FUND);

        vm.startPrank(owner);
        vault.setVendor(vendorOk, true);
        vault.setVendor(remittance, true);
        vault2.setVendor(vendorOk, true);
        vault.createSession(sessionAllow, agent, SESSION_CAP, uint64(block.timestamp + 30 days));
        vault.createSession(sessionExpired, agent, SESSION_CAP, uint64(block.timestamp - 1));
        vault.createSession(sessionRevoke, agent, SESSION_CAP, uint64(block.timestamp + 30 days));
        vault.revokeSession(sessionRevoke);
        vault.createSession(sessionOther, agent, SESSION_CAP, uint64(block.timestamp + 30 days));
        vm.stopPrank();
    }

    function _inv(uint256 n) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("invoice", n));
    }

    function _register(bytes32 sessionId, bytes32 invoiceHash, bytes32 root) internal {
        vm.prank(agent);
        vault.registerInvoice(sessionId, invoiceHash, root);
    }

    struct Snap {
        uint256 vault;
        uint256 vault2;
        uint256 vendorOk;
        uint256 vendorBad;
        uint256 remittance;
        uint256 owner;
        uint256 agent;
        uint256 attacker;
    }

    function _snap() internal view returns (Snap memory s) {
        s.vault = token.balanceOf(address(vault));
        s.vault2 = token.balanceOf(address(vault2));
        s.vendorOk = token.balanceOf(vendorOk);
        s.vendorBad = token.balanceOf(vendorBad);
        s.remittance = token.balanceOf(remittance);
        s.owner = token.balanceOf(owner);
        s.agent = token.balanceOf(agent);
        s.attacker = token.balanceOf(attacker);
    }

    function _pay(bytes32 sessionId, address vendor, uint256 amount, bytes32 invoiceHash) internal {
        vm.prank(agent);
        vault.pay(sessionId, vendor, amount, invoiceHash, ROOT_A, RESP_A, SIGNER);
    }

    function test_allowedVendor_movesMoney() public {
        bytes32 inv = _inv(1);
        _register(sessionAllow, inv, ROOT_A);
        Snap memory pre = _snap();
        vm.prank(agent);
        vm.expectEmit(true, true, true, true);
        emit BursarVault.Paid(sessionAllow, vendorOk, inv, 4938, ROOT_A, RESP_A, SIGNER, 1);
        vault.pay(sessionAllow, vendorOk, 4938, inv, ROOT_A, RESP_A, SIGNER);
        Snap memory post = _snap();
        assertEq(pre.vault - post.vault, 4938, "vault delta");
        assertEq(post.vendorOk - pre.vendorOk, 4938, "vendor delta");
        assertEq(post.vendorBad, pre.vendorBad);
        assertEq(post.agent, pre.agent);
        assertEq(post.owner, pre.owner);
        assertEq(post.vault2, pre.vault2);
        console2.log("DID MONEY MOVE? YES 4938 to vendorOk");
    }

    function test_wrongVendor_zeroMoved() public {
        bytes32 inv = _inv(2);
        _register(sessionAllow, inv, ROOT_A);
        Snap memory pre = _snap();
        vm.prank(agent);
        vm.expectRevert(BursarVault.NotVendor.selector);
        vault.pay(sessionAllow, vendorBad, 100, inv, ROOT_A, RESP_A, SIGNER);
        Snap memory post = _snap();
        assertEq(post.vault, pre.vault);
        assertEq(post.vendorBad, 0);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_overCap_zeroMoved() public {
        bytes32 sid = keccak256("tiny-cap");
        vm.prank(owner);
        vault.createSession(sid, agent, 50, uint64(block.timestamp + 30 days));
        bytes32 inv = _inv(3);
        vm.prank(agent);
        vault.registerInvoice(sid, inv, ROOT_A);
        Snap memory pre = _snap();
        vm.prank(agent);
        vm.expectRevert(BursarVault.OverCap.selector);
        vault.pay(sid, vendorOk, 51, inv, ROOT_A, RESP_A, SIGNER);
        assertEq(_snap().vault, pre.vault);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_overBand_zeroMoved() public {
        bytes32 inv = _inv(4);
        _register(sessionAllow, inv, ROOT_A);
        // BAND0 is 10000, amount 10001 is over band even if under a huge session cap
        vm.prank(agent);
        vm.expectRevert(BursarVault.OverBand.selector);
        vault.pay(sessionAllow, vendorOk, BAND0 + 1, inv, ROOT_A, RESP_A, SIGNER);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_pause_blocksPay_resumeAllows() public {
        bytes32 inv = _inv(5);
        _register(sessionAllow, inv, ROOT_A);
        vm.prank(owner);
        vault.setPaused(true);
        Snap memory pre = _snap();
        vm.prank(agent);
        vm.expectRevert(BursarVault.PausedVault.selector);
        vault.pay(sessionAllow, vendorOk, 10, inv, ROOT_A, RESP_A, SIGNER);
        assertEq(_snap().vault, pre.vault);

