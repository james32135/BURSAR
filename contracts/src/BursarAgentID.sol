// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BursarAgentID
/// @notice Clerk identity for one BURSAR workspace. Production ERC-7857 IDs
///         from 0gfoundation/0g-agentic-id: IERC7857 0x2afbede9, Authorize
///         0xdf597d99, Cloneable 0x74f8628b, ERC-721 0x80ac58cd.
/// @dev Settlement stays BursarVault USDC.e transfer. This token is identity,
///      not a payment rail. iTransferFrom / iCloneFrom revert: Foundation TEE
///      attestor is Galileo-only. transferFrom reverts (use iTransferFrom).
contract BursarAgentID {
    error Zero();
    error NotOwner();
    error BadToken();
    error AlreadyMinted();
    error AlreadyAuthorized();
    error NotAuthorized();
    error ERC7857UseITransferFrom();
    error NoMainnetAttestor();

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AuthorizationGranted(address indexed owner, address indexed user, uint256 indexed tokenId);
    event AuthorizationRevoked(address indexed owner, address indexed user, uint256 indexed tokenId);

    struct IntelligentData {
        string dataDescription;
        bytes32 dataHash;
    }

    bytes4 public constant IERC165_ID = 0x01ffc9a7;
    bytes4 public constant IERC721_ID = 0x80ac58cd;
    bytes4 public constant IERC7857_ID = 0x2afbede9;
    bytes4 public constant IERC7857_AUTHORIZE_ID = 0xdf597d99;
    bytes4 public constant IERC7857_CLONEABLE_ID = 0x74f8628b;

    address public immutable vault;
    address public immutable sessionAgent;
    address public owner;
    uint256 public totalSupply;

    mapping(uint256 => address) private _ownerOf;
    mapping(uint256 => address[]) private _authorized;
    mapping(uint256 => IntelligentData[]) private _iData;

    constructor(address owner_, address vault_, address sessionAgent_) {
        if (owner_ == address(0) || vault_ == address(0) || sessionAgent_ == address(0)) revert Zero();
        owner = owner_;
        vault = vault_;
        sessionAgent = sessionAgent_;
        _mintClerk(owner_);
        _authorize(1, sessionAgent_);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == IERC165_ID
            || interfaceId == IERC721_ID
            || interfaceId == IERC7857_ID
            || interfaceId == IERC7857_AUTHORIZE_ID
            || interfaceId == IERC7857_CLONEABLE_ID;
    }

    function name() external pure returns (string memory) {
        return "BURSAR Clerk";
    }

    function symbol() external pure returns (string memory) {
        return "BURSAR";
    }

    function balanceOf(address account) external view returns (uint256) {
        if (account == address(0)) revert Zero();
        return account == _ownerOf[1] ? 1 : 0;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _ownerOf[tokenId];
        if (o == address(0)) revert BadToken();
        return o;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_ownerOf[tokenId] == address(0)) revert BadToken();
        return "https://bursarx.vercel.app/verify";
    }

    function intelligentDatasOf(uint256 tokenId) external view returns (IntelligentData[] memory) {
        if (_ownerOf[tokenId] == address(0)) revert BadToken();
        return _iData[tokenId];
    }

    function authorizedUsersOf(uint256 tokenId) external view returns (address[] memory) {
        if (_ownerOf[tokenId] == address(0)) revert BadToken();
        return _authorized[tokenId];
    }

    function authorizeUsage(uint256 tokenId, address user) external {
        if (msg.sender != owner) revert NotOwner();
        if (_ownerOf[tokenId] == address(0)) revert BadToken();
        if (user == address(0)) revert Zero();
        _authorize(tokenId, user);
    }

    function revokeAuthorization(uint256 tokenId, address user) external {
        if (msg.sender != owner) revert NotOwner();
        if (_ownerOf[tokenId] == address(0)) revert BadToken();
        address[] storage list = _authorized[tokenId];
        for (uint256 i; i < list.length; ++i) {
            if (list[i] == user) {
                list[i] = list[list.length - 1];
                list.pop();
                emit AuthorizationRevoked(owner, user, tokenId);
                return;
            }
        }
        revert NotAuthorized();
    }

    function transferFrom(address, address, uint256) external pure {
        revert ERC7857UseITransferFrom();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert ERC7857UseITransferFrom();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert ERC7857UseITransferFrom();
    }

    /// @notice Sealed transfer needs a mainnet TEE attestor. Foundation attestor is Galileo-only.
    function iTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert NoMainnetAttestor();
    }

    function iCloneFrom(address, address, uint256, bytes calldata) external pure {
        revert NoMainnetAttestor();
    }

    function verifier() external pure returns (address) {
        return address(0);
    }

    function _mintClerk(address to) internal {
        if (totalSupply != 0) revert AlreadyMinted();
        totalSupply = 1;
        _ownerOf[1] = to;
        _iData[1].push(
            IntelligentData({
                dataDescription: "bursar-clerk-vault-session",
                dataHash: keccak256(abi.encode(vault, sessionAgent))
            })
        );
        emit Transfer(address(0), to, 1);
    }

    function _authorize(uint256 tokenId, address user) internal {
        address[] storage list = _authorized[tokenId];
        for (uint256 i; i < list.length; ++i) {
            if (list[i] == user) revert AlreadyAuthorized();
        }
        list.push(user);
        emit AuthorizationGranted(owner, user, tokenId);
    }
}
