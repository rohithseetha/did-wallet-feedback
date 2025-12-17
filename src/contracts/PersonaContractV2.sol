// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./CentomilaContractV2.sol";

/**
 * @title PersonaContractV2
 * @dev Audit-level Persona token contract inspired by Lens Protocol, ENS, and CyberConnect
 * 
 * Features:
 * - Lens Protocol-style relationship graph
 * - ENS-style profile system
 * - CyberConnect-style identity verification
 * - Reputation scoring integration
 * - Follow/unfollow mechanism
 */
contract PersonaContractV2 is AccessControl, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    
    CentomilaContractV2 public centomilaToken;
    
    // Lens Protocol-style: Relationship graph
    struct Relationship {
        address user1;
        address user2;
        uint256 tokenId;
        uint256 totalSupply;
        uint256 user1Amount;
        uint256 user2Amount;
        uint256 createdAt;
        uint256 reputationScore; // Reputation score for this relationship
        bool verified; // CyberConnect-style verification
        RelationshipType relationshipType;
    }
    
    enum RelationshipType {
        Follow,      // One-way relationship (Lens-style)
        Mutual,      // Two-way relationship
        Partnership  // Shared token partnership
    }
    
    // ENS-style: Profile system
    struct Profile {
        address owner;
        string name;
        string bio;
        string avatar;
        uint256 createdAt;
        bool verified;
        uint256 reputationScore;
        EnumerableSet.UintSet relationships; // Token IDs of relationships
    }
    
    // CyberConnect-style: Identity verification
    struct IdentityProof {
        string platform; // "github", "twitter", "lens", etc.
        string platformId;
        bytes signature;
        uint256 verifiedAt;
        bool verified;
    }
    
    mapping(uint256 => Relationship) public relationships;
    mapping(address => Profile) internal profiles;
    mapping(address => EnumerableSet.AddressSet) private following; // Lens-style follow graph
    mapping(address => EnumerableSet.AddressSet) private followers;
    mapping(address => mapping(string => IdentityProof)) public identityProofs;
    mapping(address => uint256[]) public userRelationships;
    
    uint256 public relationshipCounter;
    uint256 public constant MIN_RELATIONSHIP_SUPPLY = 100; // Minimum tokens for relationship
    
    event RelationshipCreated(
        uint256 indexed tokenId,
        address indexed user1,
        address indexed user2,
        RelationshipType relationshipType,
        uint256 totalSupply
    );
    event ProfileCreated(address indexed user, string name);
    event ProfileUpdated(address indexed user, string name, string bio);
    event IdentityVerified(address indexed user, string platform, string platformId);
    event Followed(address indexed follower, address indexed following);
    event Unfollowed(address indexed follower, address indexed unfollowing);
    event ReputationUpdated(address indexed user, uint256 newScore);
    
    constructor(address _centomilaToken) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        centomilaToken = CentomilaContractV2(_centomilaToken);
        relationshipCounter = 1000;
    }
    
    /**
     * @dev ENS-style: Create or update profile
     */
    function createProfile(
        string memory name,
        string memory bio,
        string memory avatar
    ) external {
        Profile storage profile = profiles[msg.sender];
        
        if (profile.createdAt == 0) {
            profile.owner = msg.sender;
            profile.createdAt = block.timestamp;
            emit ProfileCreated(msg.sender, name);
        } else {
            emit ProfileUpdated(msg.sender, name, bio);
        }
        
        profile.name = name;
        profile.bio = bio;
        profile.avatar = avatar;
    }
    
    /**
     * @dev Get profile information
     */
    function getProfile(address user) 
        external 
        view 
        returns (
            string memory name,
            string memory bio,
            string memory avatar,
            uint256 createdAt,
            bool verified,
            uint256 reputationScore,
            uint256 relationshipCount
        ) 
    {
        Profile storage profile = profiles[user];
        return (
            profile.name,
            profile.bio,
            profile.avatar,
            profile.createdAt,
            profile.verified,
            profile.reputationScore,
            profile.relationships.length()
        );
    }
    
    /**
     * @dev Lens Protocol-style: Follow another user
     */
    function follow(address followingUser) external {
        require(followingUser != address(0), "Invalid address");
        require(followingUser != msg.sender, "Cannot follow yourself");
        require(!following[msg.sender].contains(followingUser), "Already following");
        
        following[msg.sender].add(followingUser);
        followers[followingUser].add(msg.sender);
        
        emit Followed(msg.sender, followingUser);
    }
    
    /**
     * @dev Lens Protocol-style: Unfollow another user
     */
    function unfollow(address followingUser) external {
        require(following[msg.sender].contains(followingUser), "Not following");
        
        following[msg.sender].remove(followingUser);
        followers[followingUser].remove(msg.sender);
        
        emit Unfollowed(msg.sender, followingUser);
    }
    
    /**
     * @dev Get following list (Lens-style)
     */
    function getFollowing(address user) external view returns (address[] memory) {
        return following[user].values();
    }
    
    /**
     * @dev Get followers list (Lens-style)
     */
    function getFollowers(address user) external view returns (address[] memory) {
        return followers[user].values();
    }
    
    /**
     * @dev CyberConnect-style: Verify identity
     */
    function verifyIdentity(
        address user,
        string memory platform,
        string memory platformId,
        bytes memory signature
    ) external onlyRole(VERIFIER_ROLE) {
        require(user != address(0), "Invalid address");
        require(bytes(platform).length > 0, "Invalid platform");
        require(bytes(platformId).length > 0, "Invalid platform ID");
        
        identityProofs[user][platform] = IdentityProof({
            platform: platform,
            platformId: platformId,
            signature: signature,
            verifiedAt: block.timestamp,
            verified: true
        });
        
        // Update profile verification status
        if (profiles[user].createdAt > 0) {
            profiles[user].verified = true;
        }
        
        emit IdentityVerified(user, platform, platformId);
    }
    
    /**
     * @dev Create relationship with enhanced features
     */
    function createRelationship(
        address user1,
        address user2,
        uint256 totalSupply,
        RelationshipType relationshipType
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        require(user1 != address(0) && user2 != address(0), "Invalid addresses");
        require(user1 != user2, "Users must be different");
        require(totalSupply >= MIN_RELATIONSHIP_SUPPLY, "Supply too low");
        require(totalSupply % 2 == 0, "Total supply must be even for 50/50 split");
        
        // Generate unique token ID
        uint256 tokenId = uint256(
            keccak256(abi.encodePacked(user1, user2, block.timestamp, relationshipCounter))
        );
        
        // Ensure uniqueness
        while (relationships[tokenId].createdAt > 0) {
            tokenId = uint256(keccak256(abi.encodePacked(tokenId, block.timestamp)));
        }
        
        uint256 halfSupply = totalSupply / 2;
        
        // Mint tokens
        centomilaToken.mintCENT(user1, halfSupply);
        centomilaToken.mintCENT(user2, halfSupply);
        
        // Create relationship
        relationships[tokenId] = Relationship({
            user1: user1,
            user2: user2,
            tokenId: tokenId,
            totalSupply: totalSupply,
            user1Amount: halfSupply,
            user2Amount: halfSupply,
            createdAt: block.timestamp,
            reputationScore: 0,
            verified: profiles[user1].verified && profiles[user2].verified,
            relationshipType: relationshipType
        });
        
        // Update profiles
        profiles[user1].relationships.add(tokenId);
        profiles[user2].relationships.add(tokenId);
        
        userRelationships[user1].push(tokenId);
        userRelationships[user2].push(tokenId);
        
        relationshipCounter++;
        
        emit RelationshipCreated(tokenId, user1, user2, relationshipType, totalSupply);
    }
    
    /**
     * @dev Update reputation score for a relationship
     */
    function updateReputation(
        uint256 tokenId,
        uint256 newScore
    ) external onlyRole(OPERATOR_ROLE) {
        require(relationships[tokenId].createdAt > 0, "Relationship does not exist");
        require(newScore <= 100, "Score out of range");
        
        Relationship storage relationship = relationships[tokenId];
        relationship.reputationScore = newScore;
        
        // Update user profiles with average reputation
        _updateUserReputation(relationship.user1);
        _updateUserReputation(relationship.user2);
        
        emit ReputationUpdated(relationship.user1, profiles[relationship.user1].reputationScore);
        emit ReputationUpdated(relationship.user2, profiles[relationship.user2].reputationScore);
    }
    
    /**
     * @dev Internal: Update user reputation based on all relationships
     */
    function _updateUserReputation(address user) internal {
        Profile storage profile = profiles[user];
        if (profile.relationships.length() == 0) {
            return;
        }
        
        uint256 totalScore = 0;
        uint256 count = 0;
        
        for (uint256 i = 0; i < profile.relationships.length(); i++) {
            uint256 tokenId = profile.relationships.at(i);
            Relationship memory rel = relationships[tokenId];
            if (rel.reputationScore > 0) {
                totalScore += rel.reputationScore;
                count++;
            }
        }
        
        if (count > 0) {
            profile.reputationScore = totalScore / count;
        }
    }
    
    /**
     * @dev Get relationship information
     */
    function getRelationship(uint256 tokenId)
        external
        view
        returns (
            address user1,
            address user2,
            uint256 totalSupply,
            uint256 user1Amount,
            uint256 user2Amount,
            uint256 createdAt,
            uint256 reputationScore,
            bool verified,
            RelationshipType relationshipType
        )
    {
        Relationship memory relationship = relationships[tokenId];
        require(relationship.createdAt > 0, "Relationship does not exist");
        
        return (
            relationship.user1,
            relationship.user2,
            relationship.totalSupply,
            relationship.user1Amount,
            relationship.user2Amount,
            relationship.createdAt,
            relationship.reputationScore,
            relationship.verified,
            relationship.relationshipType
        );
    }
    
    /**
     * @dev Get all relationships for a user
     */
    function getUserRelationships(address user) external view returns (uint256[] memory) {
        return userRelationships[user];
    }
    
    /**
     * @dev Check if identity is verified (CyberConnect-style)
     */
    function isIdentityVerified(address user, string memory platform) 
        external 
        view 
        returns (bool) 
    {
        return identityProofs[user][platform].verified;
    }
}

