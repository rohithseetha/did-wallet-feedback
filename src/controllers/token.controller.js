const ethers = require('ethers');
const CentomilaContractV2 = require('../../artifacts/src/contracts/CentomilaContractV2.sol/CentomilaContractV2.json');
const { loadContractAddresses, getProvider } = require('../utils/contract-loader');
require('dotenv').config();
const { isDecodeError, logErrorIfNotDecode } = require('../utils/error-handler');
const { getGasSettings, estimateGasWithFallback, isAccessControlError, getErrorMessage } = require('../utils/gas-helper');

class TokenController {
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
      
      if (!contractData.contracts.CentomilaContractV2) {
        throw new Error(`CentomilaContractV2 address not found in deployments.json for network: ${this.network}. Please deploy contracts first.`);
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
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    } catch (error) {
      logErrorIfNotDecode('Error initializing TokenController:', error);
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
      
      let balance;
      try {
        balance = await this.contract.balanceOf(address, tokenIdToCheck);
      } catch (error) {
        // If balanceOf fails, return zero balance
        balance = 0n;
      }

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
      logErrorIfNotDecode('Error getting token balance:', error);
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      
      let tx;
      try {
        if (id === 1) {
          // Use mintCENT for CENT tokens
          const gasLimit = await estimateGasWithFallback(
            contractWithSigner,
            'mintCENT',
            [to, ethers.parseEther(amount.toString())],
            300000
          );
          tx = await contractWithSigner.mintCENT(to, ethers.parseEther(amount.toString()), {
            ...gasSettings,
            gasLimit
          });
        } else {
          // Use standard ERC1155 mint for other tokens
          const gasLimit = await estimateGasWithFallback(
            contractWithSigner,
            'mint',
            [to, id, ethers.parseEther(amount.toString()), '0x'],
            300000
          );
          tx = await contractWithSigner.mint(to, id, ethers.parseEther(amount.toString()), '0x', {
            ...gasSettings,
            gasLimit
          });
        }
      } catch (error) {
        // If mint doesn't exist, try mintCENT
        if (error.message.includes('is not a function') || error.message.includes('mint')) {
          const gasLimit = await estimateGasWithFallback(
            contractWithSigner,
            'mintCENT',
            [to, ethers.parseEther(amount.toString())],
            300000
          );
          tx = await contractWithSigner.mintCENT(to, ethers.parseEther(amount.toString()), {
            ...gasSettings,
            gasLimit
          });
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
      logErrorIfNotDecode('Error minting tokens:', error);
      
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
      
      // Pre-condition check: Verify balance
      try {
        const balance = await this.contract.balanceOf(this.wallet.address, parseInt(tokenId));
        const amountWei = ethers.parseEther(amount.toString());
        if (balance < amountWei) {
          return res.status(400).json({
            success: false,
            error: `Insufficient token balance. Available: ${ethers.formatEther(balance)} CENT, Required: ${amount} CENT`
          });
        }
      } catch (error) {
        // If balance check fails, continue - let the transaction handle it
        logErrorIfNotDecode('Error checking balance:', error);
      }
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'safeTransferFrom',
        [this.wallet.address, to, parseInt(tokenId), ethers.parseEther(amount.toString()), '0x'],
        150000
      );
      
      const tx = await contractWithSigner.safeTransferFrom(
        this.wallet.address,
        to,
        parseInt(tokenId),
        ethers.parseEther(amount.toString()),
        '0x',
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
          from: this.wallet.address,
          to,
          tokenId: parseInt(tokenId),
          amount: amount.toString()
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error transferring tokens:', error);
      
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
   * Get token info
   * GET /api/token/info
   */
  async getInfo(req, res) {
    try {
      // Try to get CENT_TOKEN_ID, default to 1 if not available
      let CENT_TOKEN_ID;
      try {
        CENT_TOKEN_ID = await this.contract.CENT_TOKEN_ID();
      } catch (error) {
        // If CENT_TOKEN_ID doesn't exist, default to 1
        CENT_TOKEN_ID = 1n;
      }

      // Get values with fallbacks for methods that might not exist or return empty
      const data = {
        centTokenId: CENT_TOKEN_ID.toString(),
        contractAddress: this.contract.address,
        network: this.network
      };

      // Try to get optional fields, use defaults if they fail
      try {
        data.uri = await this.contract.uri(CENT_TOKEN_ID);
      } catch (error) {
        data.uri = null;
      }

      try {
        const totalSupply = await this.contract.totalSupply(CENT_TOKEN_ID);
        data.totalSupply = ethers.formatEther(totalSupply.toString());
      } catch (error) {
        try {
          // Try without tokenId parameter
          const totalSupply = await this.contract.totalSupply();
          data.totalSupply = ethers.formatEther(totalSupply.toString());
        } catch (e) {
          data.totalSupply = '0';
        }
      }

      try {
        const maxSupply = await this.contract.maxSupply();
        const maxSupplySet = await this.contract.maxSupplySet();
        data.maxSupply = maxSupplySet ? ethers.formatEther(maxSupply.toString()) : null;
        data.maxSupplySet = maxSupplySet;
      } catch (error) {
        data.maxSupply = null;
        data.maxSupplySet = false;
      }

      try {
        const burnedAmount = await this.contract.getBurnedAmount(CENT_TOKEN_ID);
        data.burnedAmount = ethers.formatEther(burnedAmount.toString());
      } catch (error) {
        data.burnedAmount = '0';
      }

      try {
        data.isPaused = await this.contract.paused();
      } catch (error) {
        data.isPaused = false;
      }
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting token info:', error);
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      
      // Estimate gas with fallback
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'setApprovalForAll',
        [operator, approvedBool],
        100000
      );
      
      // Send transaction with explicit gas settings
      const tx = await contractWithSigner.setApprovalForAll(operator, approvedBool, {
        ...gasSettings,
        gasLimit
      });
      
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
      logErrorIfNotDecode('Error setting approval:', error);
      
      // Provide better error message
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
      
      // Pre-condition check: Verify balance
      try {
        const CENT_TOKEN_ID = await this.contract.CENT_TOKEN_ID();
        const balance = await this.contract.balanceOf(this.wallet.address, CENT_TOKEN_ID);
        const amountWei = ethers.parseEther(amount.toString());
        if (balance < amountWei) {
          return res.status(400).json({
            success: false,
            error: `Insufficient token balance. Available: ${ethers.formatEther(balance)} CENT, Required: ${amount} CENT`
          });
        }
      } catch (error) {
        // If balance check fails, continue - let the transaction handle it
        logErrorIfNotDecode('Error checking balance:', error);
      }
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'burnCENT',
        [ethers.parseEther(amount.toString())],
        200000
      );
      
      const tx = await contractWithSigner.burnCENT(ethers.parseEther(amount.toString()), {
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error burning tokens:', error);
      
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'batchMint',
        [to, parsedTokenIds, parsedAmounts],
        500000
      );
      
      const tx = await contractWithSigner.batchMint(to, parsedTokenIds, parsedAmounts, {
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error batch minting tokens:', error);
      
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'batchBurn',
        [parsedTokenIds, parsedAmounts],
        500000
      );
      
      const tx = await contractWithSigner.batchBurn(parsedTokenIds, parsedAmounts, {
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error batch burning tokens:', error);
      
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
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'setMaxSupply',
        [ethers.parseEther(maxSupply.toString())],
        150000
      );
      
      const tx = await contractWithSigner.setMaxSupply(ethers.parseEther(maxSupply.toString()), {
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error setting max supply:', error);
      
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
   * Pause token contract (requires PAUSER_ROLE)
   * POST /api/token/pause
   */
  async pause(req, res) {
    try {
      const contractWithSigner = this.contract.connect(this.wallet);
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'pause',
        [],
        100000
      );
      
      const tx = await contractWithSigner.pause({
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error pausing contract:', error);
      
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
   * Unpause token contract (requires PAUSER_ROLE)
   * POST /api/token/unpause
   */
  async unpause(req, res) {
    try {
      const contractWithSigner = this.contract.connect(this.wallet);
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'unpause',
        [],
        100000
      );
      
      const tx = await contractWithSigner.unpause({
        ...gasSettings,
        gasLimit
      });
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
      logErrorIfNotDecode('Error unpausing contract:', error);
      
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
      logErrorIfNotDecode('Error revoking role:', error);
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
}

module.exports = TokenController;

