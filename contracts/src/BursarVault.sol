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
