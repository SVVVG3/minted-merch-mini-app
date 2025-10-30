// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SpinRegistry
 * @dev Records on-chain proof of daily spins with EIP-712 signature verification
 * @notice This contract allows users to record their daily spins on-chain with backend authorization
 */
contract SpinRegistry {
    // Events
    event Spin(bytes32 indexed anonId, address indexed user, uint256 dayStart, uint256 timestamp);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);

    // State variables
    address public signer; // Backend's signing address
    address public owner;  // Contract owner (for signer updates)
    mapping(bytes32 => bool) public usedNonces; // Prevent replay attacks

    // EIP-712 Domain Separator
    bytes32 public DOMAIN_SEPARATOR;
    
    // EIP-712 Type Hash
    bytes32 public constant SPIN_TYPEHASH = keccak256(
        "SpinPermit(address user,uint256 dayStart,uint256 expiresAt,bytes32 nonce)"
    );

    // Structs
    struct SpinPermit {
        address user;       // Wallet address to credit
        uint256 dayStart;   // 8 AM PST boundary timestamp
        uint256 expiresAt;  // Signature expiry (short-lived)
        bytes32 nonce;      // Unique nonce to prevent replay
    }

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @dev Constructor sets the backend signer and initializes EIP-712 domain
     * @param _signer Backend's signing address
     */
    constructor(address _signer) {
        require(_signer != address(0), "Invalid signer");
        
        signer = _signer;
        owner = msg.sender;
        
        // Initialize EIP-712 Domain Separator
        uint256 chainId;
        assembly { chainId := chainid() }
        
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("MintedMerchSpins")),
            keccak256(bytes("1")),
            chainId,
            address(this)
        ));
    }

    /**
     * @dev Record a spin on-chain with backend signature verification
     * @param permit The spin permit containing user, dayStart, expiry, and nonce
     * @param signature Backend's EIP-712 signature authorizing this spin
     * @param anonId Anonymous identifier for privacy (hash of fid + dayStart + wallet)
     */
    function spin(
        SpinPermit calldata permit,
        bytes calldata signature,
        bytes32 anonId
    ) external {
        // Verify signature hasn't expired
        require(block.timestamp <= permit.expiresAt, "Signature expired");
        
        // Verify caller matches the permit
        require(msg.sender == permit.user, "Wrong sender");
        
        // Verify nonce hasn't been used (prevent replay attacks)
        require(!usedNonces[permit.nonce], "Nonce already used");
        
        // Verify EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(
            SPIN_TYPEHASH,
            permit.user,
            permit.dayStart,
            permit.expiresAt,
            permit.nonce
        ));
        
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            structHash
        ));
        
        address recovered = recoverSigner(digest, signature);
        require(recovered == signer, "Invalid signature");
        
        // Mark nonce as used
        usedNonces[permit.nonce] = true;
        
        // Emit spin event with anonymous ID for privacy
        emit Spin(anonId, permit.user, permit.dayStart, block.timestamp);
    }

    /**
     * @dev Recover signer address from signature
     * @param digest The message digest that was signed
     * @param signature The signature to verify
     * @return The recovered signer address
     */
    function recoverSigner(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        
        // Adjust v if necessary (some wallets use 0/1 instead of 27/28)
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "Invalid signature v");
        
        return ecrecover(digest, v, r, s);
    }

    /**
     * @dev Update the backend signer address (owner only)
     * @param newSigner New backend signing address
     */
    function updateSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid signer");
        
        address oldSigner = signer;
        signer = newSigner;
        
        emit SignerUpdated(oldSigner, newSigner);
    }

    /**
     * @dev Transfer ownership (owner only)
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    /**
     * @dev Check if a nonce has been used
     * @param nonce The nonce to check
     * @return Whether the nonce has been used
     */
    function isNonceUsed(bytes32 nonce) external view returns (bool) {
        return usedNonces[nonce];
    }

    /**
     * @dev Get contract version and info
     * @return name Contract name
     * @return version Contract version
     * @return chainId Current chain ID
     */
    function getContractInfo() external view returns (string memory name, string memory version, uint256 chainId) {
        uint256 currentChainId;
        assembly { currentChainId := chainid() }
        
        return ("MintedMerchSpins", "1", currentChainId);
    }
}
