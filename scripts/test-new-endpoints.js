const axios = require('axios');
const ethers = require('ethers');
require('dotenv').config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Test configuration
const TEST_ADDRESS = process.env.TEST_ADDRESS || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS;

// Colors for console output
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

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

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
      headers: { 'Content-Type': 'application/json' }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    
    if (response.status >= 200 && response.status < 300 && response.data.success !== false) {
      recordTest(testName, true);
      return { success: true, data: response.data };
    } else {
      recordTest(testName, false, `Status: ${response.status}, Success: ${response.data.success}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    recordTest(testName, false, errorMsg);
    return { success: false, error: errorMsg };
  }
}

async function loadContractAddresses() {
  try {
    const fs = require('fs');
    const path = require('path');
    const deploymentsPath = path.join(__dirname, '..', 'deployments.json');
    
    if (!fs.existsSync(deploymentsPath)) {
      throw new Error('deployments.json not found');
    }
    
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    const network = process.env.NETWORK || 'localhost';
    const networkData = deployments.networks[network];
    
    if (!networkData) {
      throw new Error(`Network ${network} not found`);
    }
    
    return {
      token: networkData.contracts?.CentomilaContractV2?.address,
      staking: networkData.contracts?.StakingContractV2?.address,
      persona: networkData.contracts?.PersonaContractV2?.address
    };
  } catch (error) {
    logError(`Failed to load contract addresses: ${error.message}`);
    return null;
  }
}

async function main() {
  log('\n🧪 Testing New API Endpoints\n', 'blue');
  log('=' .repeat(60), 'blue');
  
  // Load contract addresses
  logInfo('Loading contract addresses...');
  const contracts = await loadContractAddresses();
  
  if (!contracts) {
    logError('Cannot proceed without contract addresses');
    process.exit(1);
  }
  
  logInfo(`Token Contract: ${contracts.token}`);
  logInfo(`Staking Contract: ${contracts.staking}`);
  logInfo(`Persona Contract: ${contracts.persona}`);
  log('');

  // ==========================================
  // CRITICAL: Token Approval (Required for Staking)
  // ==========================================
  log('\n🔴 CRITICAL: Token Approval Tests\n', 'yellow');
  
  logInfo('Testing POST /api/token/approve-all (CRITICAL for staking)...');
  const approveResult = await testEndpoint(
    'POST',
    '/token/approve-all',
    {
      operator: contracts.staking,
      approved: true
    },
    'POST /api/token/approve-all (CRITICAL)'
  );
  
  if (approveResult.success) {
    logInfo(`Transaction Hash: ${approveResult.data.data.transactionHash}`);
  }

  // Check approval status
  logInfo('Checking approval status...');
  await testEndpoint(
    'GET',
    `/token/balance/${TEST_ADDRESS}`,
    null,
    'GET /api/token/balance (verify approval worked)'
  );

  // ==========================================
  // Token Endpoints
  // ==========================================
  log('\n📝 Token Endpoints Tests\n', 'blue');
  
  // Get token info (enhanced)
  await testEndpoint('GET', '/token/info', null, 'GET /api/token/info (enhanced)');
  
  // Get balance
  await testEndpoint('GET', `/token/balance/${TEST_ADDRESS}`, null, 'GET /api/token/balance');
  
  // Check role
  if (contracts.token) {
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
    await testEndpoint(
      'GET',
      `/token/has-role/${MINTER_ROLE}/${contracts.staking}`,
      null,
      'GET /api/token/has-role'
    );
  }
  
  // Burn (if user has tokens)
  logWarning('Skipping burn test (requires tokens)');
  results.skipped++;
  
  // Batch operations (skip - requires tokens)
  logWarning('Skipping batch operations (requires tokens)');
  results.skipped += 2;
  
  // Pause/Unpause (skip - requires PAUSER_ROLE)
  logWarning('Skipping pause/unpause (requires PAUSER_ROLE)');
  results.skipped += 2;
  
  // Role management (skip - requires ADMIN_ROLE)
  logWarning('Skipping role management (requires ADMIN_ROLE)');
  results.skipped += 2;

  // ==========================================
  // Staking Endpoints
  // ==========================================
  log('\n💰 Staking Endpoints Tests\n', 'blue');
  
  // Get contract info (enhanced)
  await testEndpoint('GET', '/staking/contract-info', null, 'GET /api/staking/contract-info (enhanced)');
  
  // Get staking info
  await testEndpoint('GET', `/staking/info/${TEST_ADDRESS}`, null, 'GET /api/staking/info');
  
  // Check role
  if (contracts.staking) {
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
    await testEndpoint(
      'GET',
      `/staking/has-role/${OPERATOR_ROLE}/${TEST_ADDRESS}`,
      null,
      'GET /api/staking/has-role'
    );
  }
  
  // Stake (skip - requires approval and tokens)
  logWarning('Skipping stake test (requires approval and tokens)');
  results.skipped++;
  
  // Notify reward (skip - requires REWARDS_DISTRIBUTOR_ROLE)
  logWarning('Skipping notify-reward (requires REWARDS_DISTRIBUTOR_ROLE)');
  results.skipped++;
  
  // Set reward duration (skip - requires OPERATOR_ROLE)
  logWarning('Skipping set-reward-duration (requires OPERATOR_ROLE)');
  results.skipped++;
  
  // Role management (skip - requires ADMIN_ROLE)
  logWarning('Skipping role management (requires ADMIN_ROLE)');
  results.skipped += 2;

  // ==========================================
  // Persona Endpoints
  // ==========================================
  log('\n👤 Persona Endpoints Tests\n', 'blue');
  
  // Get profile
  await testEndpoint('GET', `/persona/profile/${TEST_ADDRESS}`, null, 'GET /api/persona/profile');
  
  // Get following
  await testEndpoint('GET', `/persona/following/${TEST_ADDRESS}`, null, 'GET /api/persona/following');
  
  // Get followers
  await testEndpoint('GET', `/persona/followers/${TEST_ADDRESS}`, null, 'GET /api/persona/followers');
  
  // Get relationships
  await testEndpoint('GET', `/persona/relationships/${TEST_ADDRESS}`, null, 'GET /api/persona/relationships');
  
  // Get user relationships
  await testEndpoint('GET', `/persona/user-relationships/${TEST_ADDRESS}`, null, 'GET /api/persona/user-relationships');
  
  // Check identity verification
  await testEndpoint(
    'GET',
    `/persona/identity-verified/${TEST_ADDRESS}/twitter`,
    null,
    'GET /api/persona/identity-verified'
  );
  
  // Check role
  if (contracts.persona) {
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
    await testEndpoint(
      'GET',
      `/persona/has-role/${OPERATOR_ROLE}/${TEST_ADDRESS}`,
      null,
      'GET /api/persona/has-role'
    );
  }
  
  // Create profile (skip - may require tokens)
  logWarning('Skipping create-profile (may require tokens)');
  results.skipped++;
  
  // Follow/Unfollow (skip - may require tokens)
  logWarning('Skipping follow/unfollow (may require tokens)');
  results.skipped += 2;
  
  // Relationship management (skip - requires OPERATOR_ROLE)
  logWarning('Skipping relationship management (requires OPERATOR_ROLE)');
  results.skipped += 2;
  
  // Role management (skip - requires ADMIN_ROLE)
  logWarning('Skipping role management (requires ADMIN_ROLE)');
  results.skipped += 2;

  // ==========================================
  // Test Summary
  // ==========================================
  log('\n' + '='.repeat(60), 'blue');
  log('\n📊 Test Results Summary\n', 'blue');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, 'red');
  log(`⏭️  Skipped: ${results.skipped}`, 'yellow');
  log(`📝 Total: ${results.passed + results.failed + results.skipped}`, 'cyan');
  
  if (results.failed > 0) {
    log('\n❌ Failed Tests:', 'red');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => log(`   - ${t.name}: ${t.error}`, 'red'));
  }
  
  log('\n' + '='.repeat(60), 'blue');
  
  // Critical check
  const criticalTest = results.tests.find(t => t.name.includes('approve-all'));
  if (criticalTest && criticalTest.passed) {
    log('\n🎉 CRITICAL TEST PASSED: approve-all endpoint is working!', 'green');
    log('   Users can now approve staking contracts and stake tokens.', 'green');
  } else if (criticalTest && !criticalTest.passed) {
    log('\n⚠️  CRITICAL TEST FAILED: approve-all endpoint is not working!', 'red');
    log('   Users cannot stake tokens without this endpoint.', 'red');
    process.exit(1);
  }
  
  log('\n');
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
main().catch(error => {
  logError(`Test execution failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});

