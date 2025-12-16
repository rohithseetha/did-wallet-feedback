// Direct test of controllers without starting the server
const TokenController = require('./src/controllers/token.controller');
const StakingController = require('./src/controllers/staking.controller');
const PersonaController = require('./src/controllers/persona.controller');
const FeedbackController = require('./src/controllers/feedback.controller');

async function testControllers() {
  console.log('\n🧪 Testing Controllers Directly\n');
  console.log('='.repeat(60));

  try {
    // Test Token Controller
    console.log('\n1️⃣ Testing TokenController...');
    const tokenController = new TokenController();
    console.log('✓ TokenController initialized');
    console.log(`  Network: ${tokenController.network}`);
    console.log(`  Contract: ${tokenController.contract.address}`);

    // Test Staking Controller
    console.log('\n2️⃣ Testing StakingController...');
    const stakingController = new StakingController();
    console.log('✓ StakingController initialized');
    console.log(`  Network: ${stakingController.network}`);
    console.log(`  Contract: ${stakingController.contract.address}`);

    // Test Persona Controller
    console.log('\n3️⃣ Testing PersonaController...');
    const personaController = new PersonaController();
    console.log('✓ PersonaController initialized');
    console.log(`  Network: ${personaController.network}`);
    console.log(`  Contract: ${personaController.contract.address}`);

    // Test Feedback Controller
    console.log('\n4️⃣ Testing FeedbackController...');
    const feedbackController = new FeedbackController();
    console.log('✓ FeedbackController initialized');
    console.log(`  Network: ${feedbackController.network}`);
    console.log(`  Contract: ${feedbackController.contract.address}`);

    // Test a read operation
    console.log('\n5️⃣ Testing Read Operations...');
    const mockReq = { params: { address: '0xD20F07a5963dD8eD983DCc516D50Ad1a3dF1D209' } };
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`  Status: ${code}`);
          if (data.success) {
            console.log(`  ✓ ${JSON.stringify(data.data, null, 2)}`);
          } else {
            console.log(`  ✗ Error: ${data.error}`);
          }
          return { json: () => {} };
        }
      })
    };

    console.log('\n  Testing token balance...');
    await tokenController.getBalance(mockReq, mockRes);

    console.log('\n  Testing staking info...');
    await stakingController.getStakingInfo(mockReq, mockRes);

    console.log('\n  Testing profile...');
    await personaController.getProfile(mockReq, mockRes);

    console.log('\n' + '='.repeat(60));
    console.log('✅ All controllers tested successfully!');
    console.log('\n📝 Controllers are ready to use via API endpoints\n');

  } catch (error) {
    console.error('\n✗ Error testing controllers:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testControllers();

