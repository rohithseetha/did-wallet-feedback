const { ethers } = require('ethers');
require('dotenv').config();
const { getProvider } = require('../utils/contract-loader');

// Try to load DID dependencies, but make them optional
let Resolver, getResolver, EthrDID;
let didDependenciesAvailable = false;

try {
  Resolver = require('did-resolver').Resolver;
  getResolver = require('ethr-did-resolver').getResolver;
  EthrDID = require('ethr-did').EthrDID;
  didDependenciesAvailable = true;
} catch (error) {
  console.warn('⚠️  DID dependencies not available (ethr-did, did-resolver). Basic DID operations will work without full resolver.');
  didDependenciesAvailable = false;
}

class DIDController {
  constructor() {
    // Use shared getProvider utility to support all networks (localhost, fuji, avalanche, sepolia)
    const networkName = process.env.NETWORK || 'localhost';
    this.provider = getProvider(networkName);
    
    // Set registry and chain based on network
    if (networkName === 'fuji' || networkName === 'avalanche') {
      // Avalanche networks - use appropriate registry
      this.registry = '0xdca7ef03e98e0dc2b855be647c39abe984fcf21b'; // Default registry
      this.chainNameOrId = networkName === 'fuji' ? '0xa869' : '0xa86a'; // Fuji: 43113, Mainnet: 43114
    } else if (networkName === 'sepolia') {
      this.registry = '0xdca7ef03e98e0dc2b855be647c39abe984fcf21b';
      this.chainNameOrId = 'sepolia';
    } else {
      // Localhost - use dummy registry
      this.registry = '0x0000000000000000000000000000000000000000';
      this.chainNameOrId = 'localhost';
    }
    
    // Initialize resolver only if dependencies are available
    if (didDependenciesAvailable) {
      try {
        if (process.env.INFURA_PROJECT_ID) {
          const providerConfig = {
            networks: [
              {
                name: 'sepolia',
                provider: this.provider,
                registry: this.registry
              }
            ]
          };
          this.resolver = new Resolver(getResolver(providerConfig));
        } else {
          // For localhost, we don't need a full resolver
          this.resolver = null;
        }
      } catch (error) {
        console.warn('DID resolver initialization failed, continuing with basic operations:', error.message);
        this.resolver = null;
      }
    } else {
      this.resolver = null;
    }

    // Bind methods to maintain 'this' context
    this.generateDID = this.generateDID.bind(this);
    this.signMessage = this.signMessage.bind(this);
    this.verifySignature = this.verifySignature.bind(this);
    this.getBalance = this.getBalance.bind(this);
  }

  async generateDID(req, res) {
    try {
      // Generate a new random wallet
      const wallet = ethers.Wallet.createRandom();
      
      // Create DID string (ethr-did format: did:ethr:address)
      const didString = `did:ethr:${wallet.address}`;
      
      // If EthrDID is available, use it for full functionality
      let didInstance = null;
      if (didDependenciesAvailable && EthrDID) {
        try {
          didInstance = new EthrDID({
            identifier: wallet.address,
            privateKey: wallet.privateKey.slice(2), // Remove '0x' prefix
            provider: this.provider,
            registry: this.registry,
            chainNameOrId: this.chainNameOrId
          });
        } catch (error) {
          // If EthrDID fails, continue with basic DID string
          console.warn('EthrDID initialization failed, using basic DID format:', error.message);
        }
      }
      
      res.status(201).json({
        success: true,
        data: {
          did: didInstance?.did || didString,
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
          balance: ethers.formatEther ? ethers.formatEther(balance) : ethers.utils.formatEther(balance),
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
        
        // Create DID string
        const didString = `did:ethr:${wallet.address}`;
        
        // If EthrDID is available, use it
        let didInstance = null;
        if (didDependenciesAvailable && EthrDID) {
          try {
            didInstance = new EthrDID({
              identifier: wallet.address,
              privateKey: privateKey.slice(2), // Remove '0x' prefix
              provider: this.provider,
              registry: this.registry,
              chainNameOrId: this.chainNameOrId
            });
          } catch (error) {
            // Continue with basic DID string
          }
        }

        // Sign the feedback payload
        const payload = JSON.stringify(feedback);
        const signedMessage = await wallet.signMessage(payload);

        res.status(200).json({
          success: true,
          data: {
            signedMessage,
            did: didInstance?.did || didString
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
        
        // Create DID string
        const didString = `did:ethr:${wallet.address}`;
        
        // If EthrDID is available, use it
        let didInstance = null;
        if (didDependenciesAvailable && EthrDID) {
          try {
            didInstance = new EthrDID({
              identifier: wallet.address,
              privateKey: privateKey.slice(2), // Remove '0x' prefix
              provider: this.provider,
              registry: this.registry,
              chainNameOrId: this.chainNameOrId
            });
          } catch (error) {
            // Continue with basic DID string
          }
        }

        // Sign the message
        const signedMessage = await wallet.signMessage(message);

        res.status(200).json({
          success: true,
          data: {
            signedMessage,
            did: didInstance?.did || didString
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
      const recoveredAddress = ethers.verifyMessage ? ethers.verifyMessage(message, signature) : ethers.utils.verifyMessage(message, signature);
      
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
}

module.exports = DIDController;