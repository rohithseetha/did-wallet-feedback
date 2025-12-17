const ethers = require('ethers');
const PersonaContractV2 = require('../../artifacts/src/contracts/PersonaContractV2.sol/PersonaContractV2.json');
const { loadContractAddresses, getProvider } = require('../utils/contract-loader');
require('dotenv').config();

class PersonaController {
  constructor() {
    try {
      if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY is not set in environment variables');
      }

      // Load contract addresses
      const contractData = loadContractAddresses();
      this.network = contractData.network;
      
      if (!contractData.contracts.PersonaContractV2) {
        throw new Error('PersonaContractV2 address not found in deployments.json');
      }

      // Initialize provider
      this.provider = getProvider(this.network);

      // Initialize contract
      const contractAddress = ethers.getAddress(contractData.contracts.PersonaContractV2);
      this.contract = new ethers.Contract(
        contractAddress,
        PersonaContractV2.abi,
        this.provider
      );

      // Initialize wallet
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    } catch (error) {
      console.error('Error initializing PersonaController:', error);
      throw error;
    }
  }

  /**
   * Create or update profile
   * POST /api/persona/profile
   */
  async createProfile(req, res) {
    try {
      const { name, bio, avatar } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'name is required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.createProfile(
        name,
        bio || '',
        avatar || ''
      );
      const receipt = await tx.wait();

      res.status(201).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          user: this.wallet.address,
          name,
          bio: bio || '',
          avatar: avatar || ''
        }
      });
    } catch (error) {
      console.error('Error creating profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get profile for a user
   * GET /api/persona/profile/:address
   */
  async getProfile(req, res) {
    try {
      const { address } = req.params;
      const userAddress = address || this.wallet.address;

      const profile = await this.contract.getProfile(userAddress);
      const relationshipCount = profile.relationshipCount;

      res.status(200).json({
        success: true,
        data: {
          owner: profile.owner,
          name: profile.name,
          bio: profile.bio,
          avatar: profile.avatar,
          createdAt: new Date(Number(profile.createdAt) * 1000).toISOString(),
          verified: profile.verified,
          reputationScore: profile.reputationScore.toString(),
          relationshipCount: relationshipCount.toString()
        }
      });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Follow a user
   * POST /api/persona/follow
   */
  async follow(req, res) {
    try {
      const { following } = req.body;

      if (!following) {
        return res.status(400).json({
          success: false,
          error: 'following address is required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.follow(following);
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          follower: this.wallet.address,
          following
        }
      });
    } catch (error) {
      console.error('Error following user:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Unfollow a user
   * POST /api/persona/unfollow
   */
  async unfollow(req, res) {
    try {
      const { following } = req.body;

      if (!following) {
        return res.status(400).json({
          success: false,
          error: 'following address is required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.unfollow(following);
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          follower: this.wallet.address,
          following
        }
      });
    } catch (error) {
      console.error('Error unfollowing user:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Verify identity (requires VERIFIER_ROLE)
   * POST /api/persona/verify-identity
   */
  async verifyIdentity(req, res) {
    try {
      const { user, platform, platformId, signature } = req.body;

      if (!user || !platform || !platformId || !signature) {
        return res.status(400).json({
          success: false,
          error: 'user, platform, platformId, and signature are required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.verifyIdentity(
        user,
        platform,
        platformId,
        signature
      );
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          user,
          platform,
          platformId
        }
      });
    } catch (error) {
      console.error('Error verifying identity:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get relationships for a user
   * GET /api/persona/relationships/:address
   */
  async getRelationships(req, res) {
    try {
      const { address } = req.params;
      const userAddress = address || this.wallet.address;

      // Get user relationships - try different approaches for ethers v5/v6 compatibility
      let relationshipIds = [];
      try {
        // Try direct mapping access (ethers v5)
        relationshipIds = await this.contract.userRelationships(userAddress);
      } catch (error) {
        // If that fails, try to get relationship count from profile
        try {
          const profile = await this.contract.getProfile(userAddress);
          const count = Number(profile.relationshipCount);
          // For now, return empty if we can't access the mapping directly
          // In a real scenario, you'd need to track relationship IDs off-chain or use events
          relationshipIds = [];
        } catch (e) {
          relationshipIds = [];
        }
      }
      
      const relationships = [];

      for (let i = 0; i < relationshipIds.length; i++) {
        const relationshipId = relationshipIds[i];
        const relationship = await this.contract.relationships(relationshipId);
        
        relationships.push({
          relationshipId: relationshipId.toString(),
          user1: relationship.user1,
          user2: relationship.user2,
          tokenId: relationship.tokenId.toString(),
          totalSupply: ethers.formatEther(relationship.totalSupply.toString()),
          user1Amount: ethers.formatEther(relationship.user1Amount.toString()),
          user2Amount: ethers.formatEther(relationship.user2Amount.toString()),
          createdAt: new Date(Number(relationship.createdAt) * 1000).toISOString(),
          reputationScore: relationship.reputationScore.toString(),
          verified: relationship.verified,
          relationshipType: relationship.relationshipType
        });
      }

      res.status(200).json({
        success: true,
        data: {
          address: userAddress,
          count: relationshipIds.length.toString(),
          relationships
        }
      });
    } catch (error) {
      console.error('Error getting relationships:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Check if user follows another user
   * GET /api/persona/is-following/:follower/:following
   */
  async isFollowing(req, res) {
    try {
      const { follower, following } = req.params;

      if (!follower || !following) {
        return res.status(400).json({
          success: false,
          error: 'follower and following addresses are required'
        });
      }

      const isFollowing = await this.contract.isFollowing(follower, following);

      res.status(200).json({
        success: true,
        data: {
          follower,
          following,
          isFollowing
        }
      });
    } catch (error) {
      console.error('Error checking follow status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get following list for a user
   * GET /api/persona/following/:address?
   */
  async getFollowing(req, res) {
    try {
      const { address } = req.params;
      const userAddress = address || this.wallet.address;

      const following = await this.contract.getFollowing(userAddress);

      res.status(200).json({
        success: true,
        data: {
          address: userAddress,
          following: following,
          count: following.length
        }
      });
    } catch (error) {
      console.error('Error getting following list:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get followers list for a user
   * GET /api/persona/followers/:address?
   */
  async getFollowers(req, res) {
    try {
      const { address } = req.params;
      const userAddress = address || this.wallet.address;

      const followers = await this.contract.getFollowers(userAddress);

      res.status(200).json({
        success: true,
        data: {
          address: userAddress,
          followers: followers,
          count: followers.length
        }
      });
    } catch (error) {
      console.error('Error getting followers list:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get user relationships (token IDs array)
   * GET /api/persona/user-relationships/:address?
   */
  async getUserRelationships(req, res) {
    try {
      const { address } = req.params;
      const userAddress = address || this.wallet.address;

      const relationshipIds = await this.contract.getUserRelationships(userAddress);

      res.status(200).json({
        success: true,
        data: {
          address: userAddress,
          relationshipIds: relationshipIds.map(id => id.toString()),
          count: relationshipIds.length
        }
      });
    } catch (error) {
      console.error('Error getting user relationships:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get relationship by token ID
   * GET /api/persona/relationship/:tokenId
   */
  async getRelationship(req, res) {
    try {
      const { tokenId } = req.params;

      if (!tokenId) {
        return res.status(400).json({
          success: false,
          error: 'tokenId is required'
        });
      }

      const relationship = await this.contract.getRelationship(tokenId);

      res.status(200).json({
        success: true,
        data: {
          tokenId: tokenId,
          user1: relationship.user1,
          user2: relationship.user2,
          totalSupply: ethers.formatEther(relationship.totalSupply.toString()),
          user1Amount: ethers.formatEther(relationship.user1Amount.toString()),
          user2Amount: ethers.formatEther(relationship.user2Amount.toString()),
          createdAt: new Date(Number(relationship.createdAt) * 1000).toISOString(),
          reputationScore: relationship.reputationScore.toString(),
          verified: relationship.verified,
          relationshipType: relationship.relationshipType
        }
      });
    } catch (error) {
      console.error('Error getting relationship:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create relationship (requires OPERATOR_ROLE)
   * POST /api/persona/relationship
   */
  async createRelationship(req, res) {
    try {
      const { user1, user2, totalSupply, relationshipType } = req.body;

      if (!user1 || !user2 || !totalSupply || relationshipType === undefined) {
        return res.status(400).json({
          success: false,
          error: 'user1, user2, totalSupply, and relationshipType are required'
        });
      }

      // RelationshipType: 0 = Follow, 1 = Mutual, 2 = Partnership
      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.createRelationship(
        user1,
        user2,
        ethers.parseEther(totalSupply.toString()),
        parseInt(relationshipType)
      );
      const receipt = await tx.wait();

      res.status(201).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          user1,
          user2,
          totalSupply: totalSupply.toString(),
          relationshipType: parseInt(relationshipType),
          createdBy: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error creating relationship:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update reputation (requires OPERATOR_ROLE)
   * POST /api/persona/update-reputation
   */
  async updateReputation(req, res) {
    try {
      const { tokenId, newScore } = req.body;

      if (!tokenId || newScore === undefined) {
        return res.status(400).json({
          success: false,
          error: 'tokenId and newScore are required'
        });
      }

      if (newScore < 0 || newScore > 100) {
        return res.status(400).json({
          success: false,
          error: 'newScore must be between 0 and 100'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.updateReputation(tokenId, parseInt(newScore));
      const receipt = await tx.wait();

      const relationship = await this.contract.getRelationship(tokenId);

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          tokenId,
          newScore: parseInt(newScore),
          relationshipScore: relationship.reputationScore.toString(),
          updatedBy: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error updating reputation:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Check identity verification
   * GET /api/persona/identity-verified/:address/:platform
   */
  async isIdentityVerified(req, res) {
    try {
      const { address, platform } = req.params;

      if (!address || !platform) {
        return res.status(400).json({
          success: false,
          error: 'address and platform are required'
        });
      }

      const isVerified = await this.contract.isIdentityVerified(address, platform);

      res.status(200).json({
        success: true,
        data: {
          address,
          platform,
          isVerified
        }
      });
    } catch (error) {
      console.error('Error checking identity verification:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Grant role (requires DEFAULT_ADMIN_ROLE)
   * POST /api/persona/grant-role
   */
  async grantRole(req, res) {
    try {
      const { role, account } = req.body;

      if (!role || !account) {
        return res.status(400).json({
          success: false,
          error: 'role and account are required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.grantRole(role, account);
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          role,
          account,
          grantedBy: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error granting role:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Revoke role (requires DEFAULT_ADMIN_ROLE)
   * POST /api/persona/revoke-role
   */
  async revokeRole(req, res) {
    try {
      const { role, account } = req.body;

      if (!role || !account) {
        return res.status(400).json({
          success: false,
          error: 'role and account are required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.revokeRole(role, account);
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          role,
          account,
          revokedBy: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error revoking role:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Check if address has role
   * GET /api/persona/has-role/:role/:address
   */
  async hasRole(req, res) {
    try {
      const { role, address } = req.params;

      if (!role || !address) {
        return res.status(400).json({
          success: false,
          error: 'role and address are required'
        });
      }

      const hasRole = await this.contract.hasRole(role, address);

      res.status(200).json({
        success: true,
        data: {
          role,
          address,
          hasRole
        }
      });
    } catch (error) {
      console.error('Error checking role:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get contract constants
   * GET /api/persona/constants
   */
  async getConstants(req, res) {
    try {
      const MIN_RELATIONSHIP_SUPPLY = await this.contract.MIN_RELATIONSHIP_SUPPLY();
      const OPERATOR_ROLE = await this.contract.OPERATOR_ROLE();
      const VERIFIER_ROLE = await this.contract.VERIFIER_ROLE();
      const DEFAULT_ADMIN_ROLE = await this.contract.DEFAULT_ADMIN_ROLE();

      res.status(200).json({
        success: true,
        data: {
          minRelationshipSupply: ethers.formatEther(MIN_RELATIONSHIP_SUPPLY.toString()),
          minRelationshipSupplyRaw: MIN_RELATIONSHIP_SUPPLY.toString(),
          operatorRole: OPERATOR_ROLE,
          verifierRole: VERIFIER_ROLE,
          defaultAdminRole: DEFAULT_ADMIN_ROLE,
          contractAddress: this.contract.address,
          network: this.network
        }
      });
    } catch (error) {
      console.error('Error getting constants:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = PersonaController;

