// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SpinRegistrySecure
 * @dev SECURITY-HARDENED version of SpinRegistry with comprehensive protections
 * @notice This contract allows users to record their daily spins on-chain with backend authorization
 * @author Minted Merch Team
 */
contract SpinRegistrySecure {
    // Events
    event Spin(bytes32 indexed anonId, address indexed user, uint256 dayStart, uint256 timestamp);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // State variables
    address public signer; // Backend's signing address
    address public owner;  // Contract owner
    bool public paused;    // Emergency pause state
    
    // Nonce tracking with efficient storage
    // NOTE: nonces MUST be 32-byte cryptographically random per permit to prevent collisions
    mapping(bytes32 => bool) public usedNonces;
    
    // Rate limiting per user (optional additional protection)
    mapping(address => uint256) public lastSpinTime;
    uint256 public constant MIN_SPIN_INTERVAL = 5 minutes; // Prevent spam (reduced since we have per-day + backend gating)
    
    // Time window validation
    uint256 public constant MAX_EXPIRY_FUTURE = 5 minutes;
    
    // Per-day enforcement (optional on-chain guard)
    mapping(address => uint256) private lastDayStart;

    // EIP-712 Domain Separator
    bytes32 public immutable DOMAIN_SEPARATOR;
    
    // EIP-712 Type Hash
    bytes32 public constant SPIN_TYPEHASH = keccak256(
        "SpinPermit(address user,uint256 dayStart,uint256 expiresAt,bytes32 nonce)"
    );

    // Signature validation constants (prevent malleability)
    uint256 private constant SIGNATURE_S_UPPER_BOUND = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

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

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid address");
        _;
    }

    /**
     * @dev Constructor sets the backend signer and initializes EIP-712 domain
     * @param _signer Backend's signing address
     */
    constructor(address _signer) validAddress(_signer) {
        signer = _signer;
        owner = msg.sender;
        paused = false;
        
        // Initialize EIP-712 Domain Separator (immutable for gas efficiency)
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
    ) external whenNotPaused {
        // Basic validation
        require(permit.user == msg.sender, "Wrong sender");
        require(block.timestamp <= permit.expiresAt, "Signature expired");
        require(permit.expiresAt <= block.timestamp + MAX_EXPIRY_FUTURE, "Expiry too far");
        require(!usedNonces[permit.nonce], "Nonce already used");
        
        // Prevent future dayStart from locking users out
        require(permit.dayStart <= block.timestamp, "dayStart in future");
        
        // Optional: enforce one spin per app-day (backend controls dayStart at 8 AM PT)
        require(permit.dayStart > lastDayStart[msg.sender], "Already spun this app-day");
        
        // Rate limiting (only within same app-day to allow clean day transitions)
        if (permit.dayStart == lastDayStart[msg.sender]) {
            require(
                block.timestamp >= lastSpinTime[msg.sender] + MIN_SPIN_INTERVAL,
                "Spin too frequent"
            );
        }
        
        // Verify EIP-712 signature with malleability protection
        _verifySignature(permit, signature);
        
        // Update state
        usedNonces[permit.nonce] = true;
        lastSpinTime[msg.sender] = block.timestamp;
        lastDayStart[msg.sender] = permit.dayStart;
        
        // Emit spin event with anonymous ID for privacy
        emit Spin(anonId, permit.user, permit.dayStart, block.timestamp);
    }

    /**
     * @dev Internal function to verify EIP-712 signature with security checks
     * @param permit The spin permit to verify
     * @param signature The signature to verify
     */
    function _verifySignature(SpinPermit calldata permit, bytes calldata signature) internal view {
        require(signature.length == 65, "Invalid signature length");
        
        // Extract signature components
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        
        // Prevent signature malleability (EIP-2)
        require(uint256(s) <= SIGNATURE_S_UPPER_BOUND, "Invalid signature s value");
        
        // Adjust v if necessary
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Invalid signature v value");
        
        // Compute EIP-712 hash
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
        
        // Recover and verify signer
        address recovered = ecrecover(digest, v, r, s);
        require(recovered != address(0), "Invalid signature");
        require(recovered == signer, "Unauthorized signer");
    }

    /**
     * @dev Emergency pause function (owner only)
     */
    function pause() external onlyOwner {
        paused = true;
        emit ContractPaused(msg.sender);
    }

    /**
     * @dev Unpause function (owner only)
     */
    function unpause() external onlyOwner {
        paused = false;
        emit ContractUnpaused(msg.sender);
    }

    /**
     * @dev Update the backend signer address (owner only)
     * @param newSigner New backend signing address
     */
    function updateSigner(address newSigner) external onlyOwner validAddress(newSigner) {
        address oldSigner = signer;
        signer = newSigner;
        emit SignerUpdated(oldSigner, newSigner);
    }

    /**
     * @dev Transfer ownership (owner only)
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner validAddress(newOwner) {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @dev Emergency withdraw function (if ETH somehow gets stuck)
     * @param to Address to send ETH to
     */
    function emergencyWithdraw(address payable to) external onlyOwner validAddress(to) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool ok, ) = to.call{value: balance}("");
        require(ok, "Withdraw failed");
        emit EmergencyWithdraw(to, balance);
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
     * @dev Get user's last spin time (for rate limiting)
     * @param user User address to check
     * @return Last spin timestamp
     */
    function getUserLastSpinTime(address user) external view returns (uint256) {
        return lastSpinTime[user];
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

    /**
     * @dev Prevent accidental ETH deposits
     */
    receive() external payable {
        revert("Contract does not accept ETH");
    }

    fallback() external payable {
        revert("Function not found");
    }
}
