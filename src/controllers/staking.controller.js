const ethers = require('ethers');
const StakingContractV2 = require('../../artifacts/src/contracts/StakingContractV2.sol/StakingContractV2.json');
const { loadContractAddresses, getProvider } = require('../utils/contract-loader');
require('dotenv').config();
const { isDecodeError, logErrorIfNotDecode } = require('../utils/error-handler');
const { getGasSettings, estimateGasWithFallback, isAccessControlError, getErrorMessage } = require('../utils/gas-helper');

class StakingController {
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
      
      if (!contractData.contracts.StakingContractV2) {
        throw new Error(`StakingContractV2 address not found in deployments.json for network: ${this.network}. Please deploy contracts first.`);
      }

      // Initialize provider
      this.provider = getProvider(this.network);

      // Initialize contract
      const contractAddress = ethers.getAddress(contractData.contracts.StakingContractV2);
      this.contract = new ethers.Contract(
        contractAddress,
        StakingContractV2.abi,
        this.provider
      );

      // Initialize wallet
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    } catch (error) {
      logErrorIfNotDecode('Error initializing StakingController:', error);
      throw error;
    }
  }

  /**
   * Stake tokens
   * POST /api/staking/stake
   */
  async stake(req, res) {
    try {
      const { amount } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          error: 'amount is required'
        });
      }

      // Pre-condition check: Verify token balance and approval
      try {
        const tokenAddress = await this.contract.token();
        const TokenABI = require('../../artifacts/src/contracts/CentomilaContractV2.sol/CentomilaContractV2.json').abi;
        const tokenContract = new ethers.Contract(tokenAddress, TokenABI, this.provider);
        
        const CENT_TOKEN_ID = await tokenContract.CENT_TOKEN_ID();
        const balance = await tokenContract.balanceOf(this.wallet.address, CENT_TOKEN_ID);
        const amountWei = ethers.parseEther(amount.toString());
        
        if (balance < amountWei) {
          return res.status(400).json({
            success: false,
            error: `Insufficient token balance. Available: ${ethers.formatEther(balance)}, Required: ${amount}`
          });
        }
        
        // Check if staking contract is approved
        const stakingAddress = await this.contract.getAddress ? await this.contract.getAddress() : this.contract.target || this.contract.address;
        const isApproved = await tokenContract.isApprovedForAll(this.wallet.address, stakingAddress);
        if (!isApproved) {
          return res.status(400).json({
            success: false,
            error: 'Staking contract not approved. Please call POST /api/token/approve-all first'
          });
        }
      } catch (error) {
        // If pre-condition check fails, continue - let the transaction handle it
        logErrorIfNotDecode('Error checking pre-conditions:', error);
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'stake',
        [ethers.parseEther(amount.toString())],
        200000
      );
      
      const tx = await contractWithSigner.stake(ethers.parseEther(amount.toString()), {
        ...gasSettings,
        gasLimit
      });
      const receipt = await tx.wait();

      res.status(201).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          amount: amount.toString(),
          staker: this.wallet.address
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error staking:', error);
      
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
   * Start cooldown period before unstaking
   * POST /api/staking/cooldown
   */
  async startCooldown(req, res) {
    try {
      // Pre-condition check: Verify user has staked tokens
      try {
        const stakeInfo = await this.contract.stakes(this.wallet.address);
        if (stakeInfo.amount === 0n) {
          return res.status(400).json({
            success: false,
            error: 'No active stake found. Please stake tokens first using POST /api/staking/stake'
          });
        }
      } catch (error) {
        // If check fails, continue - let the transaction handle it
        logErrorIfNotDecode('Error checking stake:', error);
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'startCooldown',
        [],
        150000
      );
      
      const tx = await contractWithSigner.startCooldown({
        ...gasSettings,
        gasLimit
      });
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          user: this.wallet.address
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error starting cooldown:', error);
      
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
   * Unstake tokens
   * POST /api/staking/unstake
   */
  async unstake(req, res) {
    try {
      const { amount } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          error: 'amount is required'
        });
      }

      // Pre-condition check: Verify user has staked tokens and cooldown is complete
      try {
        const stakeInfo = await this.contract.stakes(this.wallet.address);
        if (stakeInfo.amount === 0n) {
          return res.status(400).json({
            success: false,
            error: 'No active stake found. Please stake tokens first using POST /api/staking/stake'
          });
        }
        
        const amountWei = ethers.parseEther(amount.toString());
        if (stakeInfo.amount < amountWei) {
          return res.status(400).json({
            success: false,
            error: `Insufficient staked amount. Staked: ${ethers.formatEther(stakeInfo.amount)} CENT, Requested: ${amount} CENT`
          });
        }
        
        // Check if cooldown has started and completed
        if (stakeInfo.cooldownStartTime === 0n) {
          return res.status(400).json({
            success: false,
            error: 'Cooldown not started. Please call POST /api/staking/cooldown first'
          });
        }
      } catch (error) {
        // If check fails, continue - let the transaction handle it
        logErrorIfNotDecode('Error checking stake:', error);
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'unstake',
        [ethers.parseEther(amount.toString())],
        200000
      );
      
      const tx = await contractWithSigner.unstake(ethers.parseEther(amount.toString()), {
        ...gasSettings,
        gasLimit
      });
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          amount: amount.toString(),
          user: this.wallet.address
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error unstaking:', error);
      
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
   * Claim rewards
   * POST /api/staking/claim
   */
  async claimRewards(req, res) {
    try {
      // Pre-condition check: Verify user has rewards available
      try {
        const stakeInfo = await this.contract.stakes(this.wallet.address);
        if (stakeInfo.amount === 0n) {
          return res.status(400).json({
            success: false,
            error: 'No active stake found. Please stake tokens first using POST /api/staking/stake'
          });
        }
        
        // Check if there are rewards available (this is approximate - actual check happens in contract)
        const rewards = await this.contract.calculateRewards(this.wallet.address).catch(() => 0n);
        if (rewards === 0n) {
          return res.status(400).json({
            success: false,
            error: 'No rewards available to claim. Rewards may not have been distributed yet.'
          });
        }
      } catch (error) {
        // If check fails, continue - let the transaction handle it
        logErrorIfNotDecode('Error checking rewards:', error);
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'claimRewards',
        [],
        200000
      );
      
      const tx = await contractWithSigner.claimRewards({
        ...gasSettings,
        gasLimit
      });
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          user: this.wallet.address
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error claiming rewards:', error);
      
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
   * Get staking info for a user
   * GET /api/staking/info/:address
   */
  async getStakingInfo(req, res) {
    try {
      const { address } = req.params;
      const userAddress = address || this.wallet.address;

      let stake, earnedRewards;
      try {
        stake = await this.contract.stakes(userAddress);
        earnedRewards = await this.contract.earned(userAddress);
      } catch (error) {
        // Return default values if contract call fails
        return res.status(200).json({
          success: true,
          data: {
            address: userAddress,
            stakedAmount: '0',
            stakedAt: null,
            lastClaimedAt: null,
            active: false,
            earnedRewards: '0',
            cooldownEndsAt: null,
            isInCooldown: false
          }
        });
      }

      const cooldownEndsAt = stake.cooldownEndsAt.toString();
      const isInCooldown = cooldownEndsAt !== '0' && parseInt(cooldownEndsAt) > Math.floor(Date.now() / 1000);

      res.status(200).json({
        success: true,
        data: {
          address: userAddress,
          stakedAmount: ethers.formatEther(stake.amount.toString()),
          stakedAt: new Date(Number(stake.stakedAt) * 1000).toISOString(),
          lastClaimedAt: new Date(Number(stake.lastClaimedAt) * 1000).toISOString(),
          active: stake.active,
          earnedRewards: ethers.formatEther(earnedRewards.toString()),
          cooldownEndsAt: cooldownEndsAt !== '0' ? new Date(parseInt(cooldownEndsAt) * 1000).toISOString() : null,
          isInCooldown
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting staking info:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get staking contract info
   * GET /api/staking/contract-info
   */
  async getContractInfo(req, res) {
    try {
      const data = {
        contractAddress: this.contract.address,
        network: this.network
      };

      // Try to get each value, use defaults if they fail
      try {
        const totalStaked = await this.contract.totalStaked();
        data.totalStaked = ethers.formatEther(totalStaked.toString());
      } catch (error) {
        data.totalStaked = '0';
      }

      try {
        const rewardRate = await this.contract.rewardRate();
        data.rewardRate = rewardRate.toString();
      } catch (error) {
        data.rewardRate = '0';
      }

      try {
        const rewardPerToken = await this.contract.rewardPerToken();
        data.rewardPerToken = ethers.formatEther(rewardPerToken.toString());
      } catch (error) {
        data.rewardPerToken = '0';
      }

      try {
        const periodFinish = await this.contract.periodFinish();
        data.periodFinish = periodFinish.toString() !== '0' ? new Date(Number(periodFinish) * 1000).toISOString() : null;
      } catch (error) {
        data.periodFinish = null;
      }

      try {
        const rewardPool = await this.contract.rewardPool();
        data.rewardPool = ethers.formatEther(rewardPool.toString());
      } catch (error) {
        data.rewardPool = '0';
      }

      try {
        const APY = await this.contract.APY();
        data.apy = APY.toString() + '%';
      } catch (error) {
        data.apy = '0%';
      }

      try {
        const MIN_LOCK_PERIOD = await this.contract.MIN_LOCK_PERIOD();
        data.minLockPeriod = MIN_LOCK_PERIOD.toString() + ' seconds';
      } catch (error) {
        data.minLockPeriod = '0 seconds';
      }

      try {
        const COOLDOWN_PERIOD = await this.contract.COOLDOWN_PERIOD();
        data.cooldownPeriod = COOLDOWN_PERIOD.toString() + ' seconds';
      } catch (error) {
        data.cooldownPeriod = '0 seconds';
      }

      try {
        const EARLY_WITHDRAWAL_PENALTY = await this.contract.EARLY_WITHDRAWAL_PENALTY();
        data.earlyWithdrawalPenalty = EARLY_WITHDRAWAL_PENALTY.toString() + '%';
      } catch (error) {
        data.earlyWithdrawalPenalty = '0%';
      }

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting contract info:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Notify reward amount (requires REWARDS_DISTRIBUTOR_ROLE)
   * POST /api/staking/notify-reward
   */
  async notifyReward(req, res) {
    try {
      const { amount } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          error: 'amount is required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'notifyRewardAmount',
        [ethers.parseEther(amount.toString())],
        200000
      );
      
      const tx = await contractWithSigner.notifyRewardAmount(ethers.parseEther(amount.toString()), {
        ...gasSettings,
        gasLimit
      });
      const receipt = await tx.wait();

      const rewardPool = await this.contract.rewardPool();
      const rewardRate = await this.contract.rewardRate();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          amount: amount.toString(),
          rewardPool: ethers.formatEther(rewardPool.toString()),
          rewardRate: rewardRate.toString(),
          notifiedBy: this.wallet.address
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error notifying reward:', error);
      
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
   * Set reward duration (requires OPERATOR_ROLE)
   * POST /api/staking/set-reward-duration
   */
  async setRewardDuration(req, res) {
    try {
      const { duration } = req.body; // Duration in seconds

      if (!duration) {
        return res.status(400).json({
          success: false,
          error: 'duration (in seconds) is required'
        });
      }

      const contractWithSigner = this.contract.connect(this.wallet);
      
      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'setRewardDuration',
        [parseInt(duration)],
        150000
      );
      
      const tx = await contractWithSigner.setRewardDuration(parseInt(duration), {
        ...gasSettings,
        gasLimit
      });
      const receipt = await tx.wait();

      res.status(200).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          duration: parseInt(duration),
          durationDays: (parseInt(duration) / 86400).toFixed(2),
          setBy: this.wallet.address
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error setting reward duration:', error);
      
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
   * POST /api/staking/grant-role
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
   * POST /api/staking/revoke-role
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
   * GET /api/staking/has-role/:role/:address
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

module.exports = StakingController;

