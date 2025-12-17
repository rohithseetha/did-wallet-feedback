const axios = require("axios");
const ethers = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) { log(`✅ ${message}`, 'green'); }
function logError(message) { log(`❌ ${message}`, 'red'); }
function logInfo(message) { log(`ℹ️  ${message}`, 'cyan'); }
function logWarning(message) { log(`⚠️  ${message}`, 'yellow'); }

const results = { passed: 0, failed: 0, skipped: 0, tests: [] };

function recordTest(name, passed, error = null) {
  results.tests.push({ name, passed, error });
  if (passed) {
    results.passed++;
    logSuccess(`${name}`);
  } else {
    results.failed++;
    logError(`${name}: ${error || 'Failed'}`);
  }
}

async function testEndpoint(method, endpoint, data = null, description = null) {
  const testName = description || `${method} ${endpoint}`;
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    };
    if (data) config.data = data;
    const response = await axios(config);
    if (response.status >= 200 && response.status < 300 && response.data.success !== false) {
      recordTest(testName, true);
      return { success: true, data: response.data };
    } else {
      recordTest(testName, false, `Status: ${response.status}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    recordTest(testName, false, errorMsg);
    return { success: false, error: errorMsg };
  }
}

async function loadContractAddresses() {
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const network = process.env.NETWORK || 'localhost';
  const networkData = deployments.networks[network];
  return {
    token: networkData.contracts?.CentomilaContractV2?.address,
    staking: networkData.contracts?.StakingContractV2?.address,
    persona: networkData.contracts?.PersonaContractV2?.address
  };
}

async function main() {
  log('\n🧪 Testing Endpoints with Role Assignment\n', 'blue');
  log('='.repeat(60), 'blue');
  
  const contracts = await loadContractAddresses();
  const apiWallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  
  logInfo(`API Wallet: ${apiWallet.address}`);
  logInfo(`Token: ${contracts.token}`);
  logInfo(`Staking: ${contracts.staking}`);
  logInfo(`Persona: ${contracts.persona}`);
  log('');
  
  // Get role hashes
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE'));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('PAUSER_ROLE'));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
  const REWARDS_DISTRIBUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('REWARDS_DISTRIBUTOR_ROLE'));
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('VERIFIER_ROLE'));
  
  // Step 1: Check current roles
  log('\n📋 Checking Current Roles\n', 'cyan');
  await testEndpoint('GET', `/token/has-role/${MINTER_ROLE}/${apiWallet.address}`, null, 'Check MINTER_ROLE');
  await testEndpoint('GET', `/staking/has-role/${OPERATOR_ROLE}/${apiWallet.address}`, null, 'Check STAKING OPERATOR_ROLE');
  await testEndpoint('GET', `/persona/has-role/${VERIFIER_ROLE}/${apiWallet.address}`, null, 'Check PERSONA VERIFIER_ROLE');
  
  // Step 2: Test minting (if has MINTER_ROLE)
  log('\n📝 Testing Token Operations\n', 'cyan');
  logInfo('Testing POST /api/token/mint...');
  const mintResult = await testEndpoint(
    'POST',
    '/token/mint',
    {
      to: apiWallet.address,
      amount: '1000'
    },
    'POST /api/token/mint'
  );
  
  if (mintResult.success) {
    // Test burning
    logInfo('Testing POST /api/token/burn...');
    await testEndpoint(
      'POST',
      '/token/burn',
      { amount: '10' },
      'POST /api/token/burn'
    );
  }
  
  // Step 3: Test staking operations
  log('\n💰 Testing Staking Operations\n', 'cyan');
  logInfo('Testing POST /api/staking/notify-reward...');
  await testEndpoint(
    'POST',
    '/staking/notify-reward',
    { amount: '1000' },
    'POST /api/staking/notify-reward'
  );
  
  logInfo('Testing POST /api/staking/set-reward-duration...');
  await testEndpoint(
    'POST',
    '/staking/set-reward-duration',
    { duration: 31536000 },
    'POST /api/staking/set-reward-duration'
  );
  
  // Step 4: Test persona operations
  log('\n👤 Testing Persona Operations\n', 'cyan');
  logInfo('Testing POST /api/persona/verify-identity...');
  await testEndpoint(
    'POST',
    '/persona/verify-identity',
    {
      user: apiWallet.address,
      platform: 'twitter',
      platformId: 'test_user_123',
      signature: '0x' + '1'.repeat(130)
    },
    'POST /api/persona/verify-identity'
  );
  
  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('\n📊 Test Results Summary\n', 'blue');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, 'red');
  log(`⏭️  Skipped: ${results.skipped}`, 'yellow');
  
  if (results.failed > 0) {
    log('\n❌ Failed Tests:', 'red');
    results.tests.filter(t => !t.passed).forEach(t => 
      log(`   - ${t.name}: ${t.error}`, 'red')
    );
  }
  
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(error => {
  logError(`Test failed: ${error.message}`);
  process.exit(1);
});

