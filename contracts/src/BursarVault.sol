// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BursarVault
/// @notice Production USDC.e accounts-payable vault for one BURSAR workspace.
/// @dev One instance, one owner. Multi-tenant isolation is BursarFactory
///      deploying a new vault per workspace, not a shared user mapping.
///      The contract is the final authority over money. The session agent
///      cannot withdraw, change policy, add vendors, raise limits, or
///      bypass pause / expiry / revoke. AI recommendations never move funds.
///      Attestation bytes are committed on-chain for /verify; TEE signature
///      recovery is enforced by the off-chain attestor before this call.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract BursarVault {
    error NotOwner();
    error NotAgent();
    error PausedVault();
    error NotVendor();
    error OverCap();
    error OverBand();
    error OverVendorCap();
    error Expired();
    error Revoked();
    error BadSession();
    error SessionExists();
    error Zero();
    error DuplicateInvoice();
    error NotRegistered();
    error RootMismatch();
    error MissingEvidence();
    error WrongToken();
    error TransferFailed();
    error InvoiceConflict();
    error Reentrant();
    error BadRecipient();

    struct Session {
        address agent;
        uint256 cap;
        uint256 spent;
        uint64 expiry;
        bool revoked;
        bool exists;
    }

    struct Invoice {
        bool registered;
        bool paid;
        bytes32 storageRoot;
    }

    struct PaymentProof {
        address vendor;
        uint256 amount;
        bytes32 storageRoot;
        bytes32 responseHash;
        address recoveredSigner;
        bytes32 sessionId;
        uint64 paidAt;
        uint64 policyVersion;
    }

    IERC20 public immutable token;
    address public owner;
    bool public paused;
    uint64 public policyVersion;
    uint256 public band0Max;
    uint256 public band1Max;

    mapping(address => bool) public vendorAllowed;
    mapping(address => uint256) public vendorCap;
    mapping(address => uint256) public vendorSpent;
    mapping(bytes32 => Session) public sessions;
    mapping(bytes32 => Invoice) public invoices;
    mapping(bytes32 => PaymentProof) public payments;

    uint256 private _locked = 1;

    event OwnershipTransferred(address indexed previous, address indexed current);
    event VendorSet(address indexed vendor, bool allowed);
    event VendorCapSet(address indexed vendor, uint256 cap);
    event BandsSet(uint256 band0Max, uint256 band1Max, uint64 policyVersion);
    event SessionCreated(bytes32 indexed id, address agent, uint256 cap, uint64 expiry);
    event SessionRevoked(bytes32 indexed id);
    event InvoiceRegistered(bytes32 indexed invoiceHash, bytes32 storageRoot);
    event Paid(
        bytes32 indexed sessionId,
        address indexed vendor,
        bytes32 indexed invoiceHash,
        uint256 amount,
        bytes32 storageRoot,
        bytes32 responseHash,
        address recoveredSigner,
        uint64 policyVersion
    );
    event Withdrawn(address indexed to, uint256 amount);
    event PausedSet(bool paused);
    event TokenRescued(address indexed token, address indexed to, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrant();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address token_, address owner_, uint256 band0Max_, uint256 band1Max_) {
        if (token_ == address(0) || owner_ == address(0)) revert Zero();
        if (band1Max_ < band0Max_) revert Zero();
        token = IERC20(token_);
        owner = owner_;
        band0Max = band0Max_;
        band1Max = band1Max_;
        policyVersion = 1;
        emit OwnershipTransferred(address(0), owner_);
        emit BandsSet(band0Max_, band1Max_, 1);
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert Zero();
        emit OwnershipTransferred(owner, next);
        owner = next;
    }

    function setPaused(bool v) external onlyOwner {
        paused = v;
        emit PausedSet(v);
    }

    function setVendor(address vendor, bool allowed) external onlyOwner {
        if (vendor == address(0) || vendor == address(this)) revert BadRecipient();
        vendorAllowed[vendor] = allowed;
        emit VendorSet(vendor, allowed);
    }

    function setVendorCap(address vendor, uint256 cap) external onlyOwner {
        if (vendor == address(0)) revert Zero();
        vendorCap[vendor] = cap;
        emit VendorCapSet(vendor, cap);
        policyVersion += 1;
    }

    function setBands(uint256 band0Max_, uint256 band1Max_) external onlyOwner {
        if (band1Max_ < band0Max_) revert Zero();
        band0Max = band0Max_;
        band1Max = band1Max_;
        policyVersion += 1;
        emit BandsSet(band0Max_, band1Max_, policyVersion);
    }

    function createSession(bytes32 id, address agent, uint256 cap, uint64 expiry) external onlyOwner {
        if (id == bytes32(0) || agent == address(0) || cap == 0) revert Zero();
        if (sessions[id].exists) revert SessionExists();
        sessions[id] = Session({
            agent: agent,
            cap: cap,
            spent: 0,
            expiry: expiry,
            revoked: false,
            exists: true
        });
        emit SessionCreated(id, agent, cap, expiry);
    }

    function revokeSession(bytes32 id) external onlyOwner {
        Session storage s = sessions[id];
        if (!s.exists) revert BadSession();
        s.revoked = true;
        emit SessionRevoked(id);
    }

    function registerInvoice(bytes32 sessionId, bytes32 invoiceHash, bytes32 storageRoot) external {
        _requireLiveAgent(sessionId);
        _register(invoiceHash, storageRoot);
    }

    function registerInvoiceOwner(bytes32 invoiceHash, bytes32 storageRoot) external onlyOwner {
        _register(invoiceHash, storageRoot);
    }

    /// @notice Band-0 session payment. Agent-only. Fail-closed on policy.
    function pay(
        bytes32 sessionId,
        address vendor,
        uint256 amount,
        bytes32 invoiceHash,
        bytes32 storageRoot,
        bytes32 responseHash,
        address recoveredSigner
    ) external nonReentrant {
        if (paused) revert PausedVault();
        Session storage s = _requireLiveAgent(sessionId);
        if (amount > band0Max) revert OverBand();
        if (s.spent + amount < s.spent || s.spent + amount > s.cap) revert OverCap();
        s.spent += amount;
        _executePay(sessionId, vendor, amount, invoiceHash, storageRoot, responseHash, recoveredSigner);
    }
