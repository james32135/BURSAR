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

        vm.prank(owner);
        vault.setPaused(false);
        _pay(sessionAllow, vendorOk, 10, inv);
        assertEq(token.balanceOf(vendorOk), 10);
        console2.log("DID MONEY MOVE after resume? YES 10");
    }

    function test_expiry_zeroMoved() public {
        bytes32 inv = _inv(6);
        vm.prank(agent);
        vm.expectRevert(BursarVault.Expired.selector);
        vault.registerInvoice(sessionExpired, inv, ROOT_A);
        Snap memory pre = _snap();
        vm.prank(agent);
        vm.expectRevert(BursarVault.Expired.selector);
        vault.pay(sessionExpired, vendorOk, 10, inv, ROOT_A, RESP_A, SIGNER);
        assertEq(_snap().vault, pre.vault);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_revoke_zeroMoved() public {
        bytes32 inv = _inv(7);
        Snap memory pre = _snap();
        vm.prank(agent);
        vm.expectRevert(BursarVault.Revoked.selector);
        vault.pay(sessionRevoke, vendorOk, 10, inv, ROOT_A, RESP_A, SIGNER);
        assertEq(_snap().vault, pre.vault);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_unauthorizedCaller_zeroMoved() public {
        bytes32 inv = _inv(8);
        _register(sessionAllow, inv, ROOT_A);
        Snap memory pre = _snap();
        vm.prank(attacker);
        vm.expectRevert(BursarVault.NotAgent.selector);
        vault.pay(sessionAllow, vendorOk, 10, inv, ROOT_A, RESP_A, SIGNER);
        assertEq(_snap().vault, pre.vault);
        assertEq(token.balanceOf(attacker), 0);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_sessionIsolation_otherSessionUnaffected() public {
        bytes32 inv = _inv(9);
        _register(sessionAllow, inv, ROOT_A);
        _pay(sessionAllow, vendorOk, 100, inv);
        (,, uint256 spentAllow,,,) = vault.sessions(sessionAllow);
        (,, uint256 spentOther,,,) = vault.sessions(sessionOther);
        assertEq(spentAllow, 100);
        assertEq(spentOther, 0);
    }

    function test_crossVaultIsolation_zeroMoved() public {
        bytes32 inv = _inv(10);
        _register(sessionAllow, inv, ROOT_A);
        Snap memory pre = _snap();
        vm.prank(agent);
        vm.expectRevert(BursarVault.BadSession.selector);
        vault2.pay(sessionAllow, vendorOk, 10, inv, ROOT_A, RESP_A, SIGNER);
        Snap memory post = _snap();
        assertEq(post.vault, pre.vault);
        assertEq(post.vault2, pre.vault2);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_duplicateInvoiceHash_replay_zeroMoved() public {
        bytes32 inv = _inv(11);
        _register(sessionAllow, inv, ROOT_A);
        _pay(sessionAllow, vendorOk, 50, inv);
        Snap memory pre = _snap();
        vm.prank(agent);
        vm.expectRevert(BursarVault.DuplicateInvoice.selector);
        vault.pay(sessionAllow, vendorOk, 50, inv, ROOT_A, RESP_A, SIGNER);
        assertEq(_snap().vendorOk, pre.vendorOk);
        console2.log("DID MONEY MOVE on replay? NO");
    }

    function test_wrongInvoiceHash_notRegistered() public {
        bytes32 inv = _inv(12);
        Snap memory pre = _snap();
        vm.prank(agent);
        vm.expectRevert(BursarVault.NotRegistered.selector);
        vault.pay(sessionAllow, vendorOk, 10, inv, ROOT_A, RESP_A, SIGNER);
        assertEq(_snap().vault, pre.vault);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_wrongStorageRoot_zeroMoved() public {
        bytes32 inv = _inv(13);
        _register(sessionAllow, inv, ROOT_A);
        vm.prank(agent);
        vm.expectRevert(BursarVault.RootMismatch.selector);
        vault.pay(sessionAllow, vendorOk, 10, inv, bytes32(uint256(0xDEAD)), RESP_A, SIGNER);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_missingEvidence_zeroMoved() public {
        bytes32 inv = _inv(14);
        _register(sessionAllow, inv, ROOT_A);
        vm.prank(agent);
        vm.expectRevert(BursarVault.MissingEvidence.selector);
        vault.pay(sessionAllow, vendorOk, 10, inv, ROOT_A, bytes32(0), SIGNER);
        vm.prank(agent);
        vm.expectRevert(BursarVault.MissingEvidence.selector);
        vault.pay(sessionAllow, vendorOk, 10, inv, ROOT_A, RESP_A, address(0));
        console2.log("DID MONEY MOVE? NO");
    }

    function test_malformedInputs() public {
        bytes32 inv = _inv(15);
        _register(sessionAllow, inv, ROOT_A);
        vm.prank(agent);
        vm.expectRevert(BursarVault.Zero.selector);
        vault.pay(sessionAllow, vendorOk, 0, inv, ROOT_A, RESP_A, SIGNER);
        vm.prank(agent);
        vm.expectRevert(BursarVault.BadRecipient.selector);
        vault.pay(sessionAllow, address(0), 1, inv, ROOT_A, RESP_A, SIGNER);
        vm.prank(agent);
        vm.expectRevert(BursarVault.BadRecipient.selector);
        vault.pay(sessionAllow, address(vault), 1, inv, ROOT_A, RESP_A, SIGNER);
        vm.prank(owner);
        vm.expectRevert(BursarVault.Zero.selector);
        vault.createSession(bytes32(0), agent, 1, uint64(block.timestamp + 1));
        vm.prank(owner);
        vm.expectRevert(BursarVault.SessionExists.selector);
        vault.createSession(sessionAllow, agent, 1, uint64(block.timestamp + 1));
    }

    function test_ownerOnly_agentCannotChangePolicyOrWithdraw() public {
        uint256 preVault = token.balanceOf(address(vault));
        vm.startPrank(agent);
        vm.expectRevert(BursarVault.NotOwner.selector);
        vault.setVendor(vendorBad, true);
        vm.expectRevert(BursarVault.NotOwner.selector);
        vault.setPaused(true);
        vm.expectRevert(BursarVault.NotOwner.selector);
        vault.setBands(1, 2);
        vm.expectRevert(BursarVault.NotOwner.selector);
        vault.setVendorCap(vendorOk, 1);
        vm.expectRevert(BursarVault.NotOwner.selector);
        vault.revokeSession(sessionAllow);
        vm.expectRevert(BursarVault.NotOwner.selector);
        vault.createSession(keccak256("x"), agent, 1, uint64(block.timestamp + 10));
        vm.expectRevert(BursarVault.NotOwner.selector);
        vault.withdraw(agent, 1);
        vm.expectRevert(BursarVault.NotOwner.selector);
        vault.ownerPay(vendorOk, 1, _inv(99), ROOT_A, RESP_A, SIGNER);
        vm.expectRevert(BursarVault.NotOwner.selector);
        vault.transferOwnership(agent);
        vm.stopPrank();
        assertEq(token.balanceOf(address(vault)), preVault);
        assertEq(token.balanceOf(agent), 0);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_ownerPay_allowedAndDuplicateProtected() public {
        bytes32 inv = _inv(16);
        vm.prank(owner);
        vault.registerInvoiceOwner(inv, ROOT_A);
        Snap memory pre = _snap();
        vm.prank(owner);
        vault.ownerPay(remittance, 3703, inv, ROOT_A, RESP_A, SIGNER);
        Snap memory post = _snap();
        assertEq(post.remittance - pre.remittance, 3703);
        assertEq(pre.vault - post.vault, 3703);
        console2.log("DID MONEY MOVE? YES 3703 ownerPay");
        vm.prank(owner);
        vm.expectRevert(BursarVault.DuplicateInvoice.selector);
        vault.ownerPay(remittance, 3703, inv, ROOT_A, RESP_A, SIGNER);
        assertEq(token.balanceOf(remittance), 3703);
        console2.log("DID MONEY MOVE on owner replay? NO");
    }

    function test_ownerPay_wrongVendor() public {
        bytes32 inv = _inv(17);
        vm.prank(owner);
        vault.registerInvoiceOwner(inv, ROOT_A);
        vm.prank(owner);
        vm.expectRevert(BursarVault.NotVendor.selector);
        vault.ownerPay(vendorBad, 1, inv, ROOT_A, RESP_A, SIGNER);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_withdraw_ownerOnly_movesMoney() public {
        Snap memory pre = _snap();
        vm.prank(owner);
        vault.withdraw(owner, 111);
        Snap memory post = _snap();
        assertEq(post.owner - pre.owner, 111);
        assertEq(pre.vault - post.vault, 111);
        console2.log("DID MONEY MOVE? YES 111 to owner");
    }

    function test_withdraw_whilePaused_stillWorks_rescue() public {
        vm.prank(owner);
        vault.setPaused(true);
        vm.prank(owner);
        vault.withdraw(owner, 5);
        assertEq(token.balanceOf(owner), 5);
        console2.log("DID MONEY MOVE while paused (owner rescue)? YES 5");
    }

    function test_wrongToken_rescueRevertsOnSettlementToken() public {
        vm.prank(owner);
        vm.expectRevert(BursarVault.WrongToken.selector);
        vault.rescueToken(address(token), owner, 1);
    }

    function test_falseReturningToken_payReverts() public {
        MockERC20FalseReturn bad = new MockERC20FalseReturn();
        BursarVault v = new BursarVault(address(bad), owner, BAND0, BAND1);
        bad.mint(address(v), 1000);
        vm.startPrank(owner);
        v.setVendor(vendorOk, true);
        v.createSession(sessionAllow, agent, 100, uint64(block.timestamp + 10));
        v.registerInvoiceOwner(_inv(1), ROOT_A);
        vm.stopPrank();
        vm.prank(agent);
        vm.expectRevert(BursarVault.TransferFailed.selector);
        v.pay(sessionAllow, vendorOk, 1, _inv(1), ROOT_A, RESP_A, SIGNER);
        assertEq(bad.balanceOf(vendorOk), 0);
        console2.log("DID MONEY MOVE? NO");
    }

    function test_vendorCap() public {
        bytes32 inv = _inv(18);
        _register(sessionAllow, inv, ROOT_A);
        vm.prank(owner);
        vault.setVendorCap(vendorOk, 25);
        vm.prank(agent);
        vm.expectRevert(BursarVault.OverVendorCap.selector);
        vault.pay(sessionAllow, vendorOk, 26, inv, ROOT_A, RESP_A, SIGNER);
        _pay(sessionAllow, vendorOk, 25, inv);
        assertEq(token.balanceOf(vendorOk), 25);
    }

    function test_bandOf() public view {
        assertEq(vault.bandOf(0), 0);
        assertEq(vault.bandOf(BAND0), 0);
        assertEq(vault.bandOf(BAND0 + 1), 1);
        assertEq(vault.bandOf(BAND1), 1);
        assertEq(vault.bandOf(BAND1 + 1), 2);
    }

    function test_registerConflict() public {
        bytes32 inv = _inv(19);
        _register(sessionAllow, inv, ROOT_A);
        vm.prank(agent);
        vault.registerInvoice(sessionAllow, inv, ROOT_A); // idempotent
        vm.prank(agent);
        vm.expectRevert(BursarVault.InvoiceConflict.selector);
        vault.registerInvoice(sessionAllow, inv, bytes32(uint256(2)));
    }

    function test_attackerCannotRegister() public {
        vm.prank(attacker);
        vm.expectRevert(BursarVault.NotAgent.selector);
        vault.registerInvoice(sessionAllow, _inv(20), ROOT_A);
    }

    function testFuzz_unlistedVendorNeverPaid(address vendor, uint96 amount, bytes32 salt) public {
        vm.assume(vendor != vendorOk && vendor != remittance && vendor != address(0) && vendor != address(vault));
        amount = uint96(bound(amount, 1, BAND0));
        bytes32 inv = keccak256(abi.encode(salt, vendor, amount));
        _register(sessionAllow, inv, ROOT_A);
        uint256 pre = token.balanceOf(vendor);
        uint256 preVault = token.balanceOf(address(vault));
        vm.prank(agent);
        vm.expectRevert(BursarVault.NotVendor.selector);
        vault.pay(sessionAllow, vendor, amount, inv, ROOT_A, RESP_A, SIGNER);
        assertEq(token.balanceOf(vendor), pre);
        assertEq(token.balanceOf(address(vault)), preVault);
    }

    function testFuzz_allowedPayWithinCaps(uint96 amount, bytes32 salt) public {
        amount = uint96(bound(amount, 1, 1000));
        bytes32 inv = keccak256(abi.encode(salt, amount, "ok"));
        _register(sessionAllow, inv, ROOT_A);
        uint256 preV = token.balanceOf(vendorOk);
        uint256 preVault = token.balanceOf(address(vault));
        _pay(sessionAllow, vendorOk, amount, inv);
        assertEq(token.balanceOf(vendorOk), preV + amount);
        assertEq(token.balanceOf(address(vault)), preVault - amount);
        (,, uint256 spent,,,) = vault.sessions(sessionAllow);
        assertLe(spent, SESSION_CAP);
    }

    function test_sessionCannotPayAnotherVaultsVendorWithoutLocalAllowlist() public {
        address onlyV2 = makeAddr("onlyV2");
        vm.prank(owner);
        vault2.setVendor(onlyV2, true);
        bytes32 inv = _inv(21);
        _register(sessionAllow, inv, ROOT_A);
        vm.prank(agent);
        vm.expectRevert(BursarVault.NotVendor.selector);
        vault.pay(sessionAllow, onlyV2, 1, inv, ROOT_A, RESP_A, SIGNER);
        console2.log("DID MONEY MOVE? NO");
    }
}
