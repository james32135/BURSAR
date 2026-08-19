// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {BursarVault} from "../src/BursarVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract VaultHandler is Test {
    BursarVault public vault;
    MockERC20 public token;
    address public owner;
    address public agent;
    address public vendorOk;
    bytes32 public sessionId;
    uint256 public ghostPaid;
    uint256 public ghostWithdrawn;
    uint256 public invoiceNonce;
    bytes32 public constant ROOT = bytes32(uint256(1));
    bytes32 public constant RESP = bytes32(uint256(2));
    address public constant SIGNER = address(0x111);

    constructor(
        BursarVault vault_,
        MockERC20 token_,
        address owner_,
        address agent_,
        address vendorOk_,
        bytes32 sessionId_
    ) {
        vault = vault_;
        token = token_;
        owner = owner_;
        agent = agent_;
        vendorOk = vendorOk_;
        sessionId = sessionId_;
    }

    function payAllowed(uint256 amount) external {
        (, uint256 cap, uint256 spent,,,) = vault.sessions(sessionId);
        uint256 remainingVault = token.balanceOf(address(vault));
        if (spent >= cap) return;
        uint256 remainingCap = cap - spent;
        uint256 maxPay = remainingCap;
        uint256 band0 = vault.band0Max();
        if (band0 < maxPay) maxPay = band0;
        if (remainingVault < maxPay) maxPay = remainingVault;
        if (maxPay == 0) return;
        if (vault.paused()) return;
        amount = bound(amount, 1, maxPay);
        bytes32 inv = keccak256(abi.encode(++invoiceNonce, amount));
        vm.prank(agent);
        vault.registerInvoice(sessionId, inv, ROOT);
        vm.prank(agent);
        vault.pay(sessionId, vendorOk, amount, inv, ROOT, RESP, SIGNER);
        ghostPaid += amount;
    }

    function payUnlisted(address vendor, uint256 amount) external {
        vendor = address(uint160(bound(uint256(uint160(vendor)), 1, type(uint160).max)));
        if (vendor == vendorOk || vendor == address(vault)) return;
        amount = bound(amount, 1, 1000);
        bytes32 inv = keccak256(abi.encode(++invoiceNonce, vendor));
        vm.prank(agent);
        vault.registerInvoice(sessionId, inv, ROOT);
        vm.prank(agent);
        try vault.pay(sessionId, vendor, amount, inv, ROOT, RESP, SIGNER) {
            revert("unlisted vendor must not be payable");
        } catch {}
    }

    function ownerWithdraw(uint256 amount) external {
        uint256 bal = token.balanceOf(address(vault));
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(owner);
        vault.withdraw(owner, amount);
        ghostWithdrawn += amount;
    }

    function pauseToggle(bool v) external {
        vm.prank(owner);
        vault.setPaused(v);
    }
}

contract BursarVaultInvariantTest is StdInvariant, Test {
    VaultHandler handler;
    BursarVault vault;
    MockERC20 token;
    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address vendorOk = makeAddr("vendorOk");
    bytes32 sessionId = keccak256("inv-session");
    uint256 constant FUND = 1_000_000;

    function setUp() public {
        token = new MockERC20();
        vault = new BursarVault(address(token), owner, 50_000, 200_000);
        token.mint(address(vault), FUND);
        vm.startPrank(owner);
        vault.setVendor(vendorOk, true);
        vault.createSession(sessionId, agent, 400_000, uint64(block.timestamp + 365 days));
        vm.stopPrank();
        handler = new VaultHandler(vault, token, owner, agent, vendorOk, sessionId);
        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = VaultHandler.payAllowed.selector;
        selectors[1] = VaultHandler.payUnlisted.selector;
        selectors[2] = VaultHandler.ownerWithdraw.selector;
        selectors[3] = VaultHandler.pauseToggle.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_conservation() public view {
        assertEq(
            token.balanceOf(address(vault)) + handler.ghostPaid() + handler.ghostWithdrawn(),
            FUND,
            "conservation"
        );
    }

    function invariant_sessionSpentLeCap() public view {
        (, uint256 cap, uint256 spent,,,) = vault.sessions(sessionId);
        assertLe(spent, cap);
    }

    function invariant_sessionSpentMatchesGhostPaidWhenUnpausedPath() public view {
        (, , uint256 spent,,,) = vault.sessions(sessionId);
        assertEq(spent, handler.ghostPaid());
    }

    function invariant_agentBalanceZero() public view {
        assertEq(token.balanceOf(agent), 0);
    }
}
