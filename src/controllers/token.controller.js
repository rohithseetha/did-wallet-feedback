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

      if (!to || !amount) {
        return res.status(400).json({
          success: false,
          error: 'to and amount are required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      
      // If tokenId is 1 (CENT token) or not provided, use mintCENT
      const id = tokenId ? parseInt(tokenId) : 1;
      
      let tx;
      try {
        if (id === 1) {
          // Use mintCENT for CENT tokens
          tx = await contractWithSigner.mintCENT(to, ethers.parseEther(amount.toString()));
        } else {
          // Use standard ERC1155 mint for other tokens
          tx = await contractWithSigner.mint(to, id, ethers.parseEther(amount.toString()), '0x');
        }
      } catch (error) {
        // If mint doesn't exist, try mintCENT
        if (error.message.includes('is not a function') || error.message.includes('mint')) {
          tx = await contractWithSigner.mintCENT(to, ethers.parseEther(amount.toString()));
        } else {
          throw error;
        }
      }

      const receipt = await tx.wait();

      res.status(201).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          to,
          tokenId: id,
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
      const totalSupply = await this.contract.totalSupply();
      const maxSupply = await this.contract.maxSupply();
      const maxSupplySet = await this.contract.maxSupplySet();
      const burnedAmount = await this.contract.getBurnedAmount(CENT_TOKEN_ID);
      const isPaused = await this.contract.paused();
      
      res.status(200).json({
        success: true,
        data: {
          centTokenId: CENT_TOKEN_ID.toString(),
          uri,
          totalSupply: ethers.formatEther(totalSupply.toString()),
          maxSupply: maxSupplySet ? ethers.formatEther(maxSupply.toString()) : null,
          maxSupplySet,
          burnedAmount: ethers.formatEther(burnedAmount.toString()),
          isPaused,
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

  /**
   * Set approval for all tokens (CRITICAL for staking)
   * POST /api/token/approve-all
   */
  async approveAll(req, res) {
    try {
      const { operator, approved } = req.body;

      if (!operator) {
        return res.status(400).json({
          success: false,
          error: 'operator address is required'
        });
      }

      const approvedBool = approved !== undefined ? approved : true;
      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.setApprovalForAll(operator, approvedBool);
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          operator,
          approved: approvedBool,
          user: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error setting approval:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Burn CENT tokens
   * POST /api/token/burn
   */
  async burn(req, res) {
    try {
      const { amount } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          error: 'amount is required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.burnCENT(ethers.parseEther(amount.toString()));
      const receipt = await tx.wait();

      const totalSupply = await this.contract.totalSupply();
      const burnedAmount = await this.contract.getBurnedAmount(1);

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          amount: amount.toString(),
          totalSupply: ethers.formatEther(totalSupply.toString()),
          totalBurned: ethers.formatEther(burnedAmount.toString()),
          burner: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error burning tokens:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Batch mint tokens
   * POST /api/token/batch-mint
   */
  async batchMint(req, res) {
    try {
      const { to, tokenIds, amounts } = req.body;

      if (!to || !tokenIds || !amounts) {
        return res.status(400).json({
          success: false,
          error: 'to, tokenIds array, and amounts array are required'
        });
      }

      if (!Array.isArray(tokenIds) || !Array.isArray(amounts)) {
        return res.status(400).json({
          success: false,
          error: 'tokenIds and amounts must be arrays'
        });
      }

      if (tokenIds.length !== amounts.length) {
        return res.status(400).json({
          success: false,
          error: 'tokenIds and amounts arrays must have the same length'
        });
      }

      const parsedTokenIds = tokenIds.map(id => parseInt(id));
      const parsedAmounts = amounts.map(amt => ethers.parseEther(amt.toString()));

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.batchMint(to, parsedTokenIds, parsedAmounts);
      const receipt = await tx.wait();

      res.status(201).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          to,
          tokenIds: parsedTokenIds,
          amounts: amounts,
          minted: amounts.length
        }
      });
    } catch (error) {
      console.error('Error batch minting tokens:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Batch burn tokens
   * POST /api/token/batch-burn
   */
  async batchBurn(req, res) {
    try {
      const { tokenIds, amounts } = req.body;

      if (!tokenIds || !amounts) {
        return res.status(400).json({
          success: false,
          error: 'tokenIds array and amounts array are required'
        });
      }

      if (!Array.isArray(tokenIds) || !Array.isArray(amounts)) {
        return res.status(400).json({
          success: false,
          error: 'tokenIds and amounts must be arrays'
        });
      }

      if (tokenIds.length !== amounts.length) {
        return res.status(400).json({
          success: false,
          error: 'tokenIds and amounts arrays must have the same length'
        });
      }

      const parsedTokenIds = tokenIds.map(id => parseInt(id));
      const parsedAmounts = amounts.map(amt => ethers.parseEther(amt.toString()));

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.batchBurn(parsedTokenIds, parsedAmounts);
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          tokenIds: parsedTokenIds,
          amounts: amounts,
          burner: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error batch burning tokens:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Set max supply (requires ADMIN_ROLE)
   * POST /api/token/set-max-supply
   */
  async setMaxSupply(req, res) {
    try {
      const { maxSupply } = req.body;

      if (!maxSupply) {
        return res.status(400).json({
          success: false,
          error: 'maxSupply is required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.setMaxSupply(ethers.parseEther(maxSupply.toString()));
      const receipt = await tx.wait();

      const newMaxSupply = await this.contract.maxSupply();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          maxSupply: ethers.formatEther(newMaxSupply.toString()),
          setBy: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error setting max supply:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Pause token contract (requires PAUSER_ROLE)
   * POST /api/token/pause
   */
  async pause(req, res) {
    try {
      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.pause();
      const receipt = await tx.wait();

      const isPaused = await this.contract.paused();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          isPaused,
          pausedBy: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error pausing contract:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Unpause token contract (requires PAUSER_ROLE)
   * POST /api/token/unpause
   */
  async unpause(req, res) {
    try {
      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.unpause();
      const receipt = await tx.wait();

      const isPaused = await this.contract.paused();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          isPaused,
          unpausedBy: this.wallet.address
        }
      });
    } catch (error) {
      console.error('Error unpausing contract:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Grant role (requires DEFAULT_ADMIN_ROLE)
   * POST /api/token/grant-role
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
   * POST /api/token/revoke-role
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
   * GET /api/token/has-role/:role/:address
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
}

module.exports = TokenController;

