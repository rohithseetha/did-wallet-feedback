const ethers = require('ethers');
const FeedbackContract = require('../contracts/Feedback.json');
const { loadContractAddresses, getProvider } = require('../utils/contract-loader');
require('dotenv').config();
const { isDecodeError, logErrorIfNotDecode } = require('../utils/error-handler');
const { getGasSettings, estimateGasWithFallback, isAccessControlError, getErrorMessage } = require('../utils/gas-helper');

class FeedbackController {
  constructor() {
    try {
      // Use MAIN_PRIVATE_KEY first (has funds), fallback to PRIVATE_KEY
      const privateKey = process.env.MAIN_PRIVATE_KEY || process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('PRIVATE_KEY or MAIN_PRIVATE_KEY must be set in environment variables');
      }

      // Load contract addresses from deployments.json
      const contractData = loadContractAddresses();
      this.network = contractData.network;
      
      if (!contractData.contracts.Feedback) {
        throw new Error(`Feedback contract address not found in deployments.json for network: ${this.network}. Please deploy contracts first.`);
      }

      // Initialize provider
      this.provider = getProvider(this.network);

      // Initialize contract
      const contractAddress = ethers.getAddress(contractData.contracts.Feedback);
      this.contract = new ethers.Contract(
        contractAddress,
        FeedbackContract.abi,
        this.provider
      );

      // Initialize wallet
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    } catch (error) {
      logErrorIfNotDecode('Error initializing FeedbackController:', error);
      throw error;
    }
  }

  async submitFeedback(req, res) {
    try {
      const { message, submitterDid, receiverDid, rating, signature } = req.body;

      if (!message || !submitterDid || !receiverDid || !rating || !signature) {
        return res.status(400).json({
          success: false,
          error: 'Message, submitter DID, receiver DID, rating, and signature are required'
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5'
        });
      }

      // Create the payload that was signed
      const payload = JSON.stringify({
        message,
        submitterDid,
        receiverDid,
        rating
      });

      // Verify the signature using ethers v6 verifyMessage (handles hashing internally)
      let recoveredAddress;
      try {
        // Check if signature is valid format first
        if (!signature || !signature.startsWith('0x') || signature.length !== 132) {
          return res.status(400).json({
            success: false,
            error: 'Invalid signature format'
          });
        }
        recoveredAddress = ethers.verifyMessage(payload, signature);
      } catch (error) {
        // If verification fails (e.g., invalid signature format), return error
        console.error('Signature verification error:', error.message);
        return res.status(400).json({
          success: false,
          error: 'Invalid signature format or verification failed',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }

      // Use the pre-initialized wallet
      const contractWithSigner = this.contract.connect(this.wallet);

      // Get gas settings
      const gasSettings = await getGasSettings(this.provider, this.network);
      const gasLimit = await estimateGasWithFallback(
        contractWithSigner,
        'submitFeedback',
        [submitterDid, receiverDid, message, rating],
        300000
      );

      // Submit feedback to the contract
      const tx = await contractWithSigner.submitFeedback(
        submitterDid,
        receiverDid,
        message,
        rating,
        {
          ...gasSettings,
          gasLimit
        }
      );
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait();

      res.status(201).json({
        success: true,
        data: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          submitterDid,
          receiverDid,
          message,
          rating,
          submitter: recoveredAddress
        }
      });
    } catch (error) {
      // Don't log signature validation errors as server errors - they're expected validation failures
      if (error.message && (error.message.includes('r must be 0') || error.message.includes('invalid signature') || error.message.includes('verification failed'))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid signature format or verification failed'
        });
      }
      logErrorIfNotDecode('Error submitting feedback:', error);
      
      const errorMsg = getErrorMessage(error);
      const statusCode = isAccessControlError(error) ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getFeedbacks(req, res) {
    try {
      let count;
      try {
        count = await this.contract.getFeedbackCount();
      } catch (error) {
        count = 0n;
      }

      const countNum = Number(count); // ethers v6 compatibility
      const feedbacks = [];

      for (let i = 0; i < countNum; i++) {
        try {
          const [submitter, submitterDid, receiverDid, message, rating, timestamp] = await this.contract.getFeedback(i);
          feedbacks.push({
            submitter,
            submitterDid,
            receiverDid,
            message,
            rating: rating.toString(),
            timestamp: new Date(Number(timestamp) * 1000).toISOString()
          });
        } catch (error) {
          // Skip invalid feedback entries
          continue;
        }
      }

      res.status(200).json({
        success: true,
        data: feedbacks
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting feedbacks:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getReputation(req, res) {
    try {
      const { did } = req.params;

      if (!did) {
        return res.status(400).json({
          success: false,
          error: 'DID is required'
        });
      }

      let totalRating, feedbackCount, averageRating;
      try {
        [totalRating, feedbackCount] = await this.contract.getReputation(did);
      } catch (error) {
        totalRating = 0n;
        feedbackCount = 0n;
      }

      try {
        averageRating = await this.contract.getAverageRating(did);
      } catch (error) {
        averageRating = 0n;
      }

      res.status(200).json({
        success: true,
        data: {
          did,
          totalRating: totalRating.toString(),
          feedbackCount: feedbackCount.toString(),
          averageRating: (Number(averageRating) / 100).toFixed(2) // Convert back to decimal
        }
      });
    } catch (error) {
      logErrorIfNotDecode('Error getting reputation:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = FeedbackController;