const ethers = require('ethers');
const { loadContractAddresses, getProvider } = require('./src/utils/contract-loader');
const CentomilaContractV2 = require('./artifacts/src/contracts/CentomilaContractV2.sol/CentomilaContractV2.json');
const StakingContractV2 = require('./artifacts/src/contracts/StakingContractV2.sol/StakingContractV2.json');
const PersonaContractV2 = require('./artifacts/src/contracts/PersonaContractV2.sol/PersonaContractV2.json');

require('dotenv').config();

async function testNewFeatures() {
  console.log('\n🧪 Testing New Backend Features\n');
  console.log('='.repeat(60));

  try {
    // Load contract addresses
    console.log('\n1️⃣ Loading contract addresses...');
    const contractData = loadContractAddresses('localhost');
    console.log('✓ Contracts loaded:', Object.keys(contractData.contracts).join(', '));

    // Get provider
    console.log('\n2️⃣ Connecting to network...');
    const provider = getProvider('localhost');
    const network = await provider.getNetwork();
    console.log(`✓ Connected to ${contractData.network} (Chain ID: ${network.chainId})`);

    // Check if we have a private key
    if (!process.env.PRIVATE_KEY) {
      console.error('✗ PRIVATE_KEY not set in .env');
      return;
    }

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`✓ Using wallet: ${wallet.address}`);

    // Test Token Contract
    console.log('\n3️⃣ Testing Token Contract (CentomilaContractV2)...');
    const tokenAddress = contractData.contracts.CentomilaContractV2;
    if (!tokenAddress) {
      console.log('⚠️  Token contract not deployed');
    } else {
      const tokenContract = new ethers.Contract(tokenAddress, CentomilaContractV2.abi, provider);
      const CENT_TOKEN_ID = await tokenContract.CENT_TOKEN_ID();
      const balance = await tokenContract.balanceOf(wallet.address, CENT_TOKEN_ID);
      console.log(`✓ Token Contract: ${tokenAddress}`);
      console.log(`✓ CENT Token ID: ${CENT_TOKEN_ID.toString()}`);
      console.log(`✓ Wallet balance: ${ethers.utils.formatEther(balance)} CENT`);
    }

    // Test Staking Contract
    console.log('\n4️⃣ Testing Staking Contract (StakingContractV2)...');
    const stakingAddress = contractData.contracts.StakingContractV2;
    if (!stakingAddress) {
      console.log('⚠️  Staking contract not deployed');
    } else {
      const stakingContract = new ethers.Contract(stakingAddress, StakingContractV2.abi, provider);
      const totalStaked = await stakingContract.totalStaked();
      const apy = await stakingContract.APY();
      const stake = await stakingContract.stakes(wallet.address);
      console.log(`✓ Staking Contract: ${stakingAddress}`);
      console.log(`✓ Total Staked: ${ethers.utils.formatEther(totalStaked)} CENT`);
      console.log(`✓ APY: ${apy.toString()}%`);
      console.log(`✓ User staked: ${ethers.utils.formatEther(stake.amount)} CENT`);
      console.log(`✓ User active: ${stake.active}`);
    }

    // Test Persona Contract
    console.log('\n5️⃣ Testing Persona Contract (PersonaContractV2)...');
    const personaAddress = contractData.contracts.PersonaContractV2;
    if (!personaAddress) {
      console.log('⚠️  Persona contract not deployed');
    } else {
      const personaContract = new ethers.Contract(personaAddress, PersonaContractV2.abi, provider);
      try {
        const profile = await personaContract.getProfile(wallet.address);
        console.log(`✓ Persona Contract: ${personaAddress}`);
        if (profile.createdAt.toString() !== '0') {
          console.log(`✓ Profile exists: ${profile.name}`);
          console.log(`✓ Verified: ${profile.verified}`);
          console.log(`✓ Reputation: ${profile.reputationScore.toString()}`);
        } else {
          console.log('⚠️  No profile created yet');
        }
      } catch (error) {
        console.log(`⚠️  Error getting profile: ${error.message}`);
      }
    }

    // Test Feedback Contract
    console.log('\n6️⃣ Testing Feedback Contract...');
    const feedbackAddress = contractData.contracts.Feedback;
    if (!feedbackAddress) {
      console.log('⚠️  Feedback contract not deployed');
    } else {
      const FeedbackContract = require('./src/contracts/Feedback.json');
      const feedbackContract = new ethers.Contract(feedbackAddress, FeedbackContract.abi, provider);
      const count = await feedbackContract.getFeedbackCount();
      console.log(`✓ Feedback Contract: ${feedbackAddress}`);
      console.log(`✓ Total feedbacks: ${count.toString()}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All contract connections tested successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start Hardhat node: npx hardhat node');
    console.log('   2. Start backend server: npm start');
    console.log('   3. Visit Swagger docs: http://localhost:3000/api-docs');
    console.log('   4. Test endpoints via API or Swagger UI\n');

  } catch (error) {
    console.error('\n✗ Error testing features:', error.message);
    console.error(error.stack);
  }
}

testNewFeatures();

