const ethers = require('ethers');
const FeedbackContract = require('../contracts/Feedback.json');
const { loadContractAddresses, getProvider } = require('../utils/contract-loader');
require('dotenv').config();

class FeedbackController {
  constructor() {
    try {
      if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY is not set in environment variables');
      }

      // Load contract addresses from deployments.json
      const contractData = loadContractAddresses();
      this.network = contractData.network;
      
      if (!contractData.contracts.Feedback) {
        throw new Error('Feedback contract address not found in deployments.json');
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
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    } catch (error) {
      console.error('Error initializing FeedbackController:', error);
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

      // Verify the signature
      const messageHash = ethers.hashMessage(payload);
      const recoveredAddress = ethers.recoverAddress(messageHash, signature);

      // Use the pre-initialized wallet
      const contractWithSigner = this.contract.connect(this.wallet);

      // Submit feedback to the contract
      const tx = await contractWithSigner.submitFeedback(
        submitterDid,
        receiverDid,
        message,
        rating
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
      console.error('Error submitting feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getFeedbacks(req, res) {
    try {
      const count = await this.contract.getFeedbackCount();
      const countNum = Number(count); // ethers v6 compatibility
      const feedbacks = [];

      for (let i = 0; i < countNum; i++) {
        const [submitter, submitterDid, receiverDid, message, rating, timestamp] = await this.contract.getFeedback(i);
        feedbacks.push({
          submitter,
          submitterDid,
          receiverDid,
          message,
          rating: rating.toString(),
          timestamp: new Date(Number(timestamp) * 1000).toISOString()
        });
      }

      res.status(200).json({
        success: true,
        data: feedbacks
      });
    } catch (error) {
      console.error('Error getting feedbacks:', error);
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

      const [totalRating, feedbackCount] = await this.contract.getReputation(did);
      const averageRating = await this.contract.getAverageRating(did);

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
      console.error('Error getting reputation:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = FeedbackController;