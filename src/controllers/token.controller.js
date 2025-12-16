const ethers = require('ethers');
const CentomilaContractV2 = require('../../artifacts/src/contracts/CentomilaContractV2.sol/CentomilaContractV2.json');
const { loadContractAddresses, getProvider } = require('../utils/contract-loader');
require('dotenv').config();

class TokenController {
  constructor() {
    try {
      if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY is not set in environment variables');
      }

      // Load contract addresses
      const contractData = loadContractAddresses();
      this.network = contractData.network;
      
      if (!contractData.contracts.CentomilaContractV2) {
        throw new Error('CentomilaContractV2 address not found in deployments.json');
      }

      // Initialize provider
      this.provider = getProvider(this.network);

      // Initialize contract
      const contractAddress = ethers.getAddress(contractData.contracts.CentomilaContractV2);
      this.contract = new ethers.Contract(
        contractAddress,
        CentomilaContractV2.abi,
        this.provider
      );

      // Initialize wallet
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    } catch (error) {
      console.error('Error initializing TokenController:', error);
      throw error;
    }
  }

  /**
   * Get token balance for a user
   * GET /api/token/balance/:address
   */
  async getBalance(req, res) {
    try {
      const { address } = req.params;
      const tokenId = req.query?.tokenId;

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Address is required'
        });
      }

      const tokenIdToCheck = tokenId ? parseInt(tokenId) : 1; // Default to CENT token (ID: 1)
      const balance = await this.contract.balanceOf(address, tokenIdToCheck);

      res.status(200).json({
        success: true,
        data: {
          address,
          tokenId: tokenIdToCheck,
          balance: balance.toString(),
          balanceFormatted: ethers.formatEther(balance)
        }
      });
    } catch (error) {
      console.error('Error getting token balance:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Mint tokens (requires MINTER_ROLE)
   * POST /api/token/mint
   */
  async mint(req, res) {
    try {
      const { to, tokenId, amount } = req.body;

      if (!to || !tokenId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'to, tokenId, and amount are required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.mint(
        to,
        parseInt(tokenId),
        ethers.parseEther(amount.toString()),
        '0x'
      );

      const receipt = await tx.wait();

      res.status(201).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          to,
          tokenId: parseInt(tokenId),
          amount: amount.toString()
        }
      });
    } catch (error) {
      console.error('Error minting tokens:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Transfer tokens
   * POST /api/token/transfer
   */
  async transfer(req, res) {
    try {
      const { to, tokenId, amount } = req.body;

      if (!to || !tokenId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'to, tokenId, and amount are required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.safeTransferFrom(
        this.wallet.address,
        to,
        parseInt(tokenId),
        ethers.parseEther(amount.toString()),
        '0x'
      );

      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          from: this.wallet.address,
          to,
          tokenId: parseInt(tokenId),
          amount: amount.toString()
        }
      });
    } catch (error) {
      console.error('Error transferring tokens:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get token info
   * GET /api/token/info
   */
  async getInfo(req, res) {
    try {
      const CENT_TOKEN_ID = await this.contract.CENT_TOKEN_ID();
      const uri = await this.contract.uri(CENT_TOKEN_ID);
      
      res.status(200).json({
        success: true,
        data: {
          centTokenId: CENT_TOKEN_ID.toString(),
          uri,
          contractAddress: this.contract.address,
          network: this.network
        }
      });
    } catch (error) {
      console.error('Error getting token info:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = TokenController;

