const ethers = require('ethers');
const StakingContractV2 = require('../../artifacts/src/contracts/StakingContractV2.sol/StakingContractV2.json');
const { loadContractAddresses, getProvider } = require('../utils/contract-loader');
require('dotenv').config();

class StakingController {
  constructor() {
    try {
      if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY is not set in environment variables');
      }

      // Load contract addresses
      const contractData = loadContractAddresses();
      this.network = contractData.network;
      
      if (!contractData.contracts.StakingContractV2) {
        throw new Error('StakingContractV2 address not found in deployments.json');
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
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    } catch (error) {
      console.error('Error initializing StakingController:', error);
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

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.stake(ethers.parseEther(amount.toString()));
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
      console.error('Error staking:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Start cooldown period before unstaking
   * POST /api/staking/cooldown
   */
  async startCooldown(req, res) {
    try {
      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.startCooldown();
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
      console.error('Error starting cooldown:', error);
      res.status(500).json({
        success: false,
        error: error.message
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

      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.unstake(ethers.parseEther(amount.toString()));
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
      console.error('Error unstaking:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Claim rewards
   * POST /api/staking/claim
   */
  async claimRewards(req, res) {
    try {
      const contractWithSigner = this.contract.connect(this.wallet);
      const tx = await contractWithSigner.claimRewards();
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
      console.error('Error claiming rewards:', error);
      res.status(500).json({
        success: false,
        error: error.message
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

      const stake = await this.contract.stakes(userAddress);
      const earnedRewards = await this.contract.earned(userAddress);
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
      console.error('Error getting staking info:', error);
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
      const totalStaked = await this.contract.totalStaked();
      const rewardRate = await this.contract.rewardRate();
      const periodFinish = await this.contract.periodFinish();
      const APY = await this.contract.APY();
      const MIN_LOCK_PERIOD = await this.contract.MIN_LOCK_PERIOD();
      const COOLDOWN_PERIOD = await this.contract.COOLDOWN_PERIOD();

      res.status(200).json({
        success: true,
        data: {
          totalStaked: ethers.formatEther(totalStaked.toString()),
          rewardRate: rewardRate.toString(),
          periodFinish: periodFinish.toString() !== '0' ? new Date(Number(periodFinish) * 1000).toISOString() : null,
          apy: APY.toString() + '%',
          minLockPeriod: MIN_LOCK_PERIOD.toString() + ' seconds',
          cooldownPeriod: COOLDOWN_PERIOD.toString() + ' seconds',
          contractAddress: this.contract.address,
          network: this.network
        }
      });
    } catch (error) {
      console.error('Error getting contract info:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = StakingController;

