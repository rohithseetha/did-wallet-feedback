// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CentomilaContractV2
 * @dev Audit-level ERC-1155 token contract with enhanced features
 * Based on OpenZeppelin audited contracts with additional security measures
 * 
 * Features:
 * - OpenZeppelin ERC1155 (audited)
 * - Pausable for emergency stops
 * - Maximum supply cap
 * - Batch operations for gas efficiency
 * - Enhanced burn logic
 * - Comprehensive event emissions
 */
contract CentomilaContractV2 is 
    ERC1155, 
    AccessControl, 
    ERC1155Burnable, 
    ERC1155Pausable,
    ReentrancyGuard 
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint256 public constant CENT_TOKEN_ID = 1;
    uint256 public constant DECIMALS = 18;
    
    uint256 public totalSupply;
    uint256 public maxSupply; // Maximum supply cap
    bool public maxSupplySet;
    
    // Track burned amounts per token ID
    mapping(uint256 => uint256) public burnedAmounts;
    
    event CENTMinted(address indexed to, uint256 amount, uint256 newTotalSupply);
    event CENTBurned(address indexed from, uint256 amount, uint256 newTotalSupply);
    event MaxSupplySet(uint256 maxSupply);
    event BatchMinted(address indexed to, uint256[] tokenIds, uint256[] amounts);
    event BatchBurned(address indexed from, uint256[] tokenIds, uint256[] amounts);
    
    /**
     * @dev Constructor
     * @param uri_ Base URI for token metadata
     */
    constructor(string memory uri_) ERC1155(uri_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }
    
    /**
     * @dev Set maximum supply (can only be set once)
     * @param _maxSupply Maximum supply cap
     */
    function setMaxSupply(uint256 _maxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!maxSupplySet, "Max supply already set");
        require(_maxSupply > 0, "Max supply must be greater than 0");
        maxSupply = _maxSupply;
        maxSupplySet = true;
        emit MaxSupplySet(_maxSupply);
    }
    
    /**
     * @dev Mint CENT tokens (with supply cap check)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in wei, 18 decimals)
     */
    function mintCENT(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        
        if (maxSupplySet) {
            require(totalSupply + amount <= maxSupply, "Exceeds max supply");
        }
        
        _mint(to, CENT_TOKEN_ID, amount, "");
        totalSupply += amount;
        
        emit CENTMinted(to, amount, totalSupply);
    }
    
    /**
     * @dev Batch mint tokens (gas efficient)
     * @param to Address to mint tokens to
     * @param tokenIds Array of token IDs
     * @param amounts Array of amounts
     */
    function batchMint(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(to != address(0), "Cannot mint to zero address");
        require(tokenIds.length == amounts.length, "Arrays length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            totalAmount += amounts[i];
        }
        
        if (maxSupplySet) {
            require(totalSupply + totalAmount <= maxSupply, "Exceeds max supply");
        }
        
        _mintBatch(to, tokenIds, amounts, "");
        totalSupply += totalAmount;
        
        emit BatchMinted(to, tokenIds, amounts);
    }
    
    /**
     * @dev Burn CENT tokens (enhanced with tracking)
     * @param amount Amount to burn (in wei, 18 decimals)
     */
    function burnCENT(uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender, CENT_TOKEN_ID) >= amount, "Insufficient balance");
        
        _burn(msg.sender, CENT_TOKEN_ID, amount);
        totalSupply -= amount;
        burnedAmounts[CENT_TOKEN_ID] += amount;
        
        emit CENTBurned(msg.sender, amount, totalSupply);
    }
    
    /**
     * @dev Batch burn tokens (gas efficient)
     * @param tokenIds Array of token IDs
     * @param amounts Array of amounts
     */
    function batchBurn(
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(tokenIds.length == amounts.length, "Arrays length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            require(balanceOf(msg.sender, tokenIds[i]) >= amounts[i], "Insufficient balance");
            totalAmount += amounts[i];
            burnedAmounts[tokenIds[i]] += amounts[i];
        }
        
        _burnBatch(msg.sender, tokenIds, amounts);
        totalSupply -= totalAmount;
        
        emit BatchBurned(msg.sender, tokenIds, amounts);
    }
    
    /**
     * @dev Get CENT balance for an address
     */
    function balanceOfCENT(address account) external view returns (uint256) {
        return balanceOf(account, CENT_TOKEN_ID);
    }
    
    /**
     * @dev Get total burned amount for a token ID
     */
    function getBurnedAmount(uint256 tokenId) external view returns (uint256) {
        return burnedAmounts[tokenId];
    }
    
    /**
     * @dev Pause contract (emergency stop)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Override required for multiple inheritance
     */
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Pausable)
    {
        super._update(from, to, ids, values);
    }
    
    /**
     * @dev Supports ERC165 interface
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

