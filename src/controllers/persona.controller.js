const ethers = require('ethers');
const PersonaContractV2 = require('../../artifacts/src/contracts/PersonaContractV2.sol/PersonaContractV2.json');
const { loadContractAddresses, getProvider } = require('../utils/contract-loader');
const { isDecodeError, logErrorIfNotDecode } = require('../utils/error-handler');
const { getGasSettings, estimateGasWithFallback, isAccessControlError, getErrorMessage } = require('../utils/gas-helper');
require('dotenv').config();

class PersonaController {
  constructor() {
    try {
      // Use MAIN_PRIVATE_KEY first (has funds), fallback to PRIVATE_KEY
      const privateKey = process.env.MAIN_PRIVATE_KEY || process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('PRIVATE_KEY or MAIN_PRIVATE_KEY must be set in environment variables');
      }

      // Load contract addresses
      const contractData = loadContractAddresses();
      this.network = contractData.network;
      
      if (!contractData.contracts.PersonaContractV2) {
        throw new Error(`PersonaContractV2 address not found in deployments.json for network: ${this.network}. Please deploy contracts first.`);
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
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    } catch (error) {
      logErrorIfNotDecode('Error initializing PersonaController:', error);
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'createProfile',
        [name, bio || '', avatar || ''],
        200000
      );
      
      const tx = await contractWithSigner.createProfile(
        name,
        bio || '',
        avatar || '',
        {
          ...gasSettings,
          gasLimit
        }
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
      logErrorIfNotDecode('Error creating profile:', error);
      
      const errorMsg = getErrorMessage(error);
      const statusCode = isAccessControlError(error) ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

      let profile;
      try {
        profile = await this.contract.getProfile(userAddress);
      } catch (error) {
        // Return default profile if contract call fails
        return res.status(200).json({
          success: true,
          data: {
            owner: userAddress,
            name: '',
            bio: '',
            avatar: '',
            createdAt: null,
            verified: false,
            reputationScore: '0',
            relationshipCount: '0'
          }
        });
      }

      const relationshipCount = profile.relationshipCount;

      res.status(200).json({
        success: true,
        data: {
          owner: profile.owner || userAddress,
          name: profile.name || '',
          bio: profile.bio || '',
          avatar: profile.avatar || '',
          createdAt: profile.createdAt && profile.createdAt.toString() !== '0' 
            ? new Date(Number(profile.createdAt) * 1000).toISOString() 
            : null,
          verified: profile.verified || false,
          reputationScore: profile.reputationScore ? profile.reputationScore.toString() : '0',
          relationshipCount: relationshipCount ? relationshipCount.toString() : '0'
        }
      });
    } catch (error) {
      // Don't log decode errors - they're expected when contracts aren't initialized
      logErrorIfNotDecode('getting profile', error);
      // Return default profile for decode errors, error response for other errors
      if (isDecodeError(error)) {
        return res.status(200).json({
          success: true,
          data: {
            owner: req.params.address || this.wallet.address,
            name: '',
            bio: '',
            avatar: '',
            createdAt: null,
            verified: false,
            reputationScore: '0',
            relationshipCount: '0'
          }
        });
      }
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'follow',
        [following],
        150000
      );
      
      const tx = await contractWithSigner.follow(following, {
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error following user:', error);
      
      const errorMsg = getErrorMessage(error);
      const statusCode = isAccessControlError(error) ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'unfollow',
        [following],
        150000
      );
      
      const tx = await contractWithSigner.unfollow(following, {
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error unfollowing user:', error);
      
      const errorMsg = getErrorMessage(error);
      const statusCode = isAccessControlError(error) ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'verifyIdentity',
        [user, platform, platformId, signature],
        200000
      );
      
      const tx = await contractWithSigner.verifyIdentity(
        user,
        platform,
        platformId,
        signature,
        {
          ...gasSettings,
          gasLimit
        }
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
      logErrorIfNotDecode('Error verifying identity:', error);
      
      const errorMsg = getErrorMessage(error);
      const statusCode = isAccessControlError(error) ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      logErrorIfNotDecode('Error getting relationships:', error);
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

      // Get the following list and check if the address is in it
      const followingList = await this.contract.getFollowing(follower);
      const isFollowing = followingList.some(addr => addr.toLowerCase() === following.toLowerCase());

      res.status(200).json({
        success: true,
        data: {
          follower,
          following,
          isFollowing
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error checking follow status:', error);
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

      let following;
      try {
        following = await this.contract.getFollowing(userAddress);
      } catch (error) {
        following = [];
      }

      res.status(200).json({
        success: true,
        data: {
          address: userAddress,
          following: following || [],
          count: following ? following.length : 0
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting following list:', error);
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

      let followers;
      try {
        followers = await this.contract.getFollowers(userAddress);
      } catch (error) {
        followers = [];
      }

      res.status(200).json({
        success: true,
        data: {
          address: userAddress,
          followers: followers || [],
          count: followers ? followers.length : 0
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting followers list:', error);
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

      let relationshipIds;
      try {
        relationshipIds = await this.contract.getUserRelationships(userAddress);
      } catch (error) {
        relationshipIds = [];
      }

      res.status(200).json({
        success: true,
        data: {
          address: userAddress,
          relationshipIds: relationshipIds ? relationshipIds.map(id => id.toString()) : [],
          count: relationshipIds ? relationshipIds.length : 0
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting user relationships:', error);
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

      let relationship;
      try {
        relationship = await this.contract.getRelationship(tokenId);
      } catch (error) {
        // Return null relationship if not found
        return res.status(200).json({
          success: true,
          data: {
            tokenId: tokenId,
            user1: null,
            user2: null,
            totalSupply: '0',
            user1Amount: '0',
            user2Amount: '0',
            createdAt: null,
            reputationScore: '0',
            verified: false,
            relationshipType: 0
          }
        });
      }

      res.status(200).json({
        success: true,
        data: {
          tokenId: tokenId,
          user1: relationship.user1,
          user2: relationship.user2,
          totalSupply: ethers.formatEther(relationship.totalSupply.toString()),
          user1Amount: ethers.formatEther(relationship.user1Amount.toString()),
          user2Amount: ethers.formatEther(relationship.user2Amount.toString()),
          createdAt: relationship.createdAt && relationship.createdAt.toString() !== '0'
            ? new Date(Number(relationship.createdAt) * 1000).toISOString()
            : null,
          reputationScore: relationship.reputationScore ? relationship.reputationScore.toString() : '0',
          verified: relationship.verified || false,
          relationshipType: relationship.relationshipType || 0
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting relationship:', error);
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'createRelationship',
        [user1, user2, ethers.parseEther(totalSupply.toString()), parseInt(relationshipType)],
        300000
      );
      
      const tx = await contractWithSigner.createRelationship(
        user1,
        user2,
        ethers.parseEther(totalSupply.toString()),
        parseInt(relationshipType),
        {
          ...gasSettings,
          gasLimit
        }
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
      logErrorIfNotDecode('Error creating relationship:', error);
      
      const errorMsg = getErrorMessage(error);
      const statusCode = isAccessControlError(error) ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'updateReputation',
        [tokenId, parseInt(newScore)],
        150000
      );
      
      const tx = await contractWithSigner.updateReputation(tokenId, parseInt(newScore), {
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error updating reputation:', error);
      
      const errorMsg = getErrorMessage(error);
      const statusCode = isAccessControlError(error) ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

      let isVerified;
      try {
        const proof = await this.contract.identityProofs(address, platform);
        isVerified = proof.verified || false;
      } catch (error) {
        // If identityProofs fails, check if method exists or default to false
        try {
          isVerified = await this.contract.isIdentityVerified(address, platform);
        } catch (e) {
          isVerified = false;
        }
      }

      res.status(200).json({
        success: true,
        data: {
          address,
          platform,
          isVerified
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error checking identity verification:', error);
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'grantRole',
        [role, account],
        150000
      );
      
      const tx = await contractWithSigner.grantRole(role, account, {
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error granting role:', error);
      
      const errorMsg = getErrorMessage(error);
      const statusCode = isAccessControlError(error) ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'revokeRole',
        [role, account],
        150000
      );
      
      const tx = await contractWithSigner.revokeRole(role, account, {
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error revoking role:', error);
      
      const errorMsg = getErrorMessage(error);
      const statusCode = isAccessControlError(error) ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

      let hasRole;
      try {
        hasRole = await this.contract.hasRole(role, address);
      } catch (error) {
        // If hasRole fails, default to false
        hasRole = false;
      }

      res.status(200).json({
        success: true,
        data: {
          role,
          address,
          hasRole
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error checking role:', error);
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
      const data = {
        contractAddress: this.contract.address,
        network: this.network
      };

      // Try to get each constant, use defaults if they fail
      try {
        const MIN_RELATIONSHIP_SUPPLY = await this.contract.MIN_RELATIONSHIP_SUPPLY();
        data.minRelationshipSupply = ethers.formatEther(MIN_RELATIONSHIP_SUPPLY.toString());
        data.minRelationshipSupplyRaw = MIN_RELATIONSHIP_SUPPLY.toString();
      } catch (error) {
        data.minRelationshipSupply = '0';
        data.minRelationshipSupplyRaw = '0';
      }

      try {
        data.operatorRole = await this.contract.OPERATOR_ROLE();
      } catch (error) {
        data.operatorRole = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
      }

      try {
        data.verifierRole = await this.contract.VERIFIER_ROLE();
      } catch (error) {
        data.verifierRole = ethers.keccak256(ethers.toUtf8Bytes('VERIFIER_ROLE'));
      }

      try {
        data.defaultAdminRole = await this.contract.DEFAULT_ADMIN_ROLE();
      } catch (error) {
        data.defaultAdminRole = '0x0000000000000000000000000000000000000000000000000000000000000000';
      }

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting constants:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = PersonaController;

