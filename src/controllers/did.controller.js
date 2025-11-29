const { Resolver } = require('did-resolver');
const { getResolver } = require('ethr-did-resolver');
const { EthrDID } = require('ethr-did');
const { ethers } = require('ethers');
const User = require('../models/User');
require('dotenv').config();

class DIDController {
  constructor() {
    // Initialize the provider with Infura project ID
    this.provider = new ethers.providers.JsonRpcProvider(
      `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
    );
    
    // Configure the resolver with explicit provider and registry
    const providerConfig = {
      networks: [
        {
          name: 'sepolia',
          provider: this.provider,
          registry: '0xdca7ef03e98e0dc2b855be647c39abe984fcf21b'
        }
      ]
    };
    
    this.resolver = new Resolver(getResolver(providerConfig));

    // Bind methods to maintain 'this' context
    this.generateDID = this.generateDID.bind(this);
    this.signMessage = this.signMessage.bind(this);
    this.verifySignature = this.verifySignature.bind(this);
    this.getBalance = this.getBalance.bind(this);
    this.registerUser = this.registerUser.bind(this);
    this.getUser = this.getUser.bind(this);
    this.updateUser = this.updateUser.bind(this);
    this.listUsers = this.listUsers.bind(this);
  }

  async generateDID(req, res) {
    try {
      // Generate a new random wallet
      const wallet = ethers.Wallet.createRandom();
      
      // Create a new EthrDID instance
      const did = new EthrDID({
        identifier: wallet.address,
        privateKey: wallet.privateKey.slice(2), // Remove '0x' prefix
        provider: this.provider,
        registry: '0xdca7ef03e98e0dc2b855be647c39abe984fcf21b',
        chainNameOrId: 'sepolia'
      });
      
      res.status(201).json({
        success: true,
        data: {
          did: did.did,
          address: wallet.address,
          privateKey: wallet.privateKey
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getBalance(req, res) {
    try {
      const { address } = req.params;

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Address is required'
        });
      }

      const balance = await this.provider.getBalance(address);
      
      res.status(200).json({
        success: true,
        data: {
          address,
          balance: ethers.utils.formatEther(balance),
          balanceWei: balance.toString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async signMessage(req, res) {
    try {
      const { message, privateKey, feedback } = req.body;

      // Check if we're signing a feedback payload or a simple message
      if (feedback) {
        if (!privateKey) {
          return res.status(400).json({
            success: false,
            error: 'Private key is required'
          });
        }

        if (!feedback.message || !feedback.submitterDid || !feedback.receiverDid || !feedback.rating) {
          return res.status(400).json({
            success: false,
            error: 'Feedback payload must include message, submitterDid, receiverDid, and rating'
          });
        }

        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey, this.provider);
        
        // Create EthrDID instance
        const did = new EthrDID({
          identifier: wallet.address,
          privateKey: privateKey.slice(2), // Remove '0x' prefix
          provider: this.provider,
          registry: '0xdca7ef03e98e0dc2b855be647c39abe984fcf21b',
          chainNameOrId: 'sepolia'
        });

        // Sign the feedback payload
        const payload = JSON.stringify(feedback);
        const signedMessage = await wallet.signMessage(payload);

        res.status(200).json({
          success: true,
          data: {
            signedMessage,
            did: did.did
          }
        });
      } else {
        // Handle simple message signing
        if (!message || !privateKey) {
          return res.status(400).json({
            success: false,
            error: 'Message and private key are required'
          });
        }

        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey, this.provider);
        
        // Create EthrDID instance
        const did = new EthrDID({
          identifier: wallet.address,
          privateKey: privateKey.slice(2), // Remove '0x' prefix
          provider: this.provider,
          registry: '0xdca7ef03e98e0dc2b855be647c39abe984fcf21b',
          chainNameOrId: 'sepolia'
        });

        // Sign the message
        const signedMessage = await wallet.signMessage(message);

        res.status(200).json({
          success: true,
          data: {
            signedMessage,
            did: did.did
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async verifySignature(req, res) {
    try {
      const { message, signature, address } = req.body;

      if (!message || !signature || !address) {
        return res.status(400).json({
          success: false,
          error: 'Message, signature, and address are required'
        });
      }

      // Recover the address from the signature
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);

      // Check if the recovered address matches the provided address
      const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();

      res.status(200).json({
        success: true,
        data: {
          isValid,
          recoveredAddress
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async registerUser(req, res) {
    try {
      const { address, profile } = req.body;

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Address is required'
        });
      }

      // Validate Ethereum address format
      if (!ethers.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
      }

      // Create DID from address
      const did = `did:ethr:sepolia:${address.toLowerCase()}`;

      // Check if user already exists
      const existingUser = await User.findOne({ address: address.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User with this address already exists',
          data: {
            did: existingUser.did,
            address: existingUser.address
          }
        });
      }

      // Create new user
      const user = new User({
        address: address.toLowerCase(),
        did,
        profile: profile || {}
      });

      await user.save();

      res.status(201).json({
        success: true,
        data: {
          did: user.did,
          address: user.address,
          profile: user.profile,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUser(req, res) {
    try {
      const { address } = req.params;

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Address is required'
        });
      }

      const user = await User.findOne({ address: address.toLowerCase() });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          did: user.did,
          address: user.address,
          profile: user.profile,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateUser(req, res) {
    try {
      const { address } = req.params;
      const { profile } = req.body;

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Address is required'
        });
      }

      const user = await User.findOneAndUpdate(
        { address: address.toLowerCase() },
        { $set: { profile } },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          did: user.did,
          address: user.address,
          profile: user.profile,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Get total count for pagination metadata
      const total = await User.countDocuments();

      // Get paginated users
      const users = await User.find()
        .select('did address profile createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: {
          users: users.map(user => ({
            did: user.did,
            address: user.address,
            profile: user.profile,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          })),
          pagination: {
            currentPage: page,
            totalPages,
            totalUsers: total,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = DIDController;