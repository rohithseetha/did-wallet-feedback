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
}

module.exports = PersonaController;

