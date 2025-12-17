const hre = require("hardhat");
const { ethers } = require("hardhat");
const { getAccounts } = require("./get-accounts");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

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
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
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
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error('deployments.json not found');
  }
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const network = hre.network.name;
  const networkData = deployments.networks[network];
  
  if (!networkData) {
    throw new Error(`Network ${network} not found`);
  }
  
  return {
    token: networkData.contracts?.CentomilaContractV2?.address,
    staking: networkData.contracts?.StakingContractV2?.address,
    persona: networkData.contracts?.PersonaContractV2?.address
  };
}

async function assignRoles() {
  log('\n🔐 Assigning Roles to API Wallet\n', 'blue');
  log('='.repeat(60), 'blue');
  
  const accounts = await getAccounts();
  const deployer = accounts.deployer;
  const contracts = await loadContractAddresses();
  
  // Get API wallet address from PRIVATE_KEY
  const ethers = require("ethers");
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const apiWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  logInfo(`Deployer: ${deployer.address}`);
  logInfo(`API Wallet: ${apiWallet.address}`);
  logInfo(`Token: ${contracts.token}`);
  logInfo(`Staking: ${contracts.staking}`);
  logInfo(`Persona: ${contracts.persona}`);
  log('');
  
  // Get contract factories
  const CentomilaContractV2 = await hre.ethers.getContractFactory("CentomilaContractV2");
  const StakingContractV2 = await hre.ethers.getContractFactory("StakingContractV2");
  const PersonaContractV2 = await hre.ethers.getContractFactory("PersonaContractV2");
  
  const token = CentomilaContractV2.attach(contracts.token);
  const staking = StakingContractV2.attach(contracts.staking);
  const persona = PersonaContractV2.attach(contracts.persona);
  
  const roleAssignments = [];
  
  try {
    // Token Contract Roles - Grant to API wallet
    logInfo('Assigning Token Contract roles to API wallet...');
    
    const MINTER_ROLE = await token.MINTER_ROLE();
    const BURNER_ROLE = await token.BURNER_ROLE();
    const PAUSER_ROLE = await token.PAUSER_ROLE();
    const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    
    // Grant MINTER_ROLE to API wallet
    if (!(await token.hasRole(MINTER_ROLE, apiWallet.address))) {
      const tx = await token.connect(deployer).grantRole(MINTER_ROLE, apiWallet.address);
      await tx.wait();
      logSuccess(`Granted MINTER_ROLE to ${apiWallet.address}`);
      roleAssignments.push({ contract: 'Token', role: 'MINTER_ROLE', account: apiWallet.address });
    } else {
      logInfo(`MINTER_ROLE already granted to ${apiWallet.address}`);
    }
    
    // Grant BURNER_ROLE to API wallet
    if (!(await token.hasRole(BURNER_ROLE, apiWallet.address))) {
      const tx = await token.connect(deployer).grantRole(BURNER_ROLE, apiWallet.address);
      await tx.wait();
      logSuccess(`Granted BURNER_ROLE to ${apiWallet.address}`);
      roleAssignments.push({ contract: 'Token', role: 'BURNER_ROLE', account: apiWallet.address });
    } else {
      logInfo(`BURNER_ROLE already granted to ${apiWallet.address}`);
    }
    
    // Grant PAUSER_ROLE to API wallet
    if (!(await token.hasRole(PAUSER_ROLE, apiWallet.address))) {
      const tx = await token.connect(deployer).grantRole(PAUSER_ROLE, apiWallet.address);
      await tx.wait();
      logSuccess(`Granted PAUSER_ROLE to ${apiWallet.address}`);
      roleAssignments.push({ contract: 'Token', role: 'PAUSER_ROLE', account: apiWallet.address });
    } else {
      logInfo(`PAUSER_ROLE already granted to ${apiWallet.address}`);
    }
    
    // Staking Contract Roles - Grant to API wallet
    logInfo('Assigning Staking Contract roles to API wallet...');
    
    const STAKING_OPERATOR_ROLE = await staking.OPERATOR_ROLE();
    const STAKING_REWARDS_DISTRIBUTOR_ROLE = await staking.REWARDS_DISTRIBUTOR_ROLE();
    
    // Grant OPERATOR_ROLE to API wallet
    if (!(await staking.hasRole(STAKING_OPERATOR_ROLE, apiWallet.address))) {
      const tx = await staking.connect(deployer).grantRole(STAKING_OPERATOR_ROLE, apiWallet.address);
      await tx.wait();
      logSuccess(`Granted OPERATOR_ROLE to ${apiWallet.address} (Staking)`);
      roleAssignments.push({ contract: 'Staking', role: 'OPERATOR_ROLE', account: apiWallet.address });
    } else {
      logInfo(`OPERATOR_ROLE already granted to ${apiWallet.address} (Staking)`);
    }
    
    // Grant REWARDS_DISTRIBUTOR_ROLE to API wallet
    if (!(await staking.hasRole(STAKING_REWARDS_DISTRIBUTOR_ROLE, apiWallet.address))) {
      const tx = await staking.connect(deployer).grantRole(STAKING_REWARDS_DISTRIBUTOR_ROLE, apiWallet.address);
      await tx.wait();
      logSuccess(`Granted REWARDS_DISTRIBUTOR_ROLE to ${apiWallet.address}`);
      roleAssignments.push({ contract: 'Staking', role: 'REWARDS_DISTRIBUTOR_ROLE', account: apiWallet.address });
    } else {
      logInfo(`REWARDS_DISTRIBUTOR_ROLE already granted to ${apiWallet.address}`);
    }
    
    // Persona Contract Roles - Grant to API wallet
    logInfo('Assigning Persona Contract roles to API wallet...');
    
    const PERSONA_OPERATOR_ROLE = await persona.OPERATOR_ROLE();
    const PERSONA_VERIFIER_ROLE = await persona.VERIFIER_ROLE();
    
    // Grant OPERATOR_ROLE to API wallet
    if (!(await persona.hasRole(PERSONA_OPERATOR_ROLE, apiWallet.address))) {
      const tx = await persona.connect(deployer).grantRole(PERSONA_OPERATOR_ROLE, apiWallet.address);
      await tx.wait();
      logSuccess(`Granted OPERATOR_ROLE to ${apiWallet.address} (Persona)`);
      roleAssignments.push({ contract: 'Persona', role: 'OPERATOR_ROLE', account: apiWallet.address });
    } else {
      logInfo(`OPERATOR_ROLE already granted to ${apiWallet.address} (Persona)`);
    }
    
    // Grant VERIFIER_ROLE to API wallet
    if (!(await persona.hasRole(PERSONA_VERIFIER_ROLE, apiWallet.address))) {
      const tx = await persona.connect(deployer).grantRole(PERSONA_VERIFIER_ROLE, apiWallet.address);
      await tx.wait();
      logSuccess(`Granted VERIFIER_ROLE to ${apiWallet.address}`);
      roleAssignments.push({ contract: 'Persona', role: 'VERIFIER_ROLE', account: apiWallet.address });
    } else {
      logInfo(`VERIFIER_ROLE already granted to ${apiWallet.address}`);
    }
    
    log('\n✅ Role assignment complete!\n', 'green');
    return roleAssignments;
    
  } catch (error) {
    logError(`Error assigning roles: ${error.message}`);
    throw error;
  }
}

async function testRoleBasedEndpoints() {
  log('\n🧪 Testing Role-Based Endpoints\n', 'blue');
  log('='.repeat(60), 'blue');
  
  const contracts = await loadContractAddresses();
  const accounts = await getAccounts();
  const deployer = accounts.deployer;
  
  // ==========================================
  // Token Endpoints (Require Roles)
  // ==========================================
  log('\n📝 Testing Token Endpoints with Roles\n', 'cyan');
  
  // Mint tokens (requires MINTER_ROLE)
  logInfo('Testing POST /api/token/mint (requires MINTER_ROLE)...');
  await testEndpoint(
    'POST',
    '/token/mint',
    {
      to: deployer.address,
      tokenId: 1,
      amount: '1000'
    },
    'POST /api/token/mint (MINTER_ROLE)'
  );
  
  // Batch mint (requires MINTER_ROLE)
  logInfo('Testing POST /api/token/batch-mint...');
  await testEndpoint(
    'POST',
    '/token/batch-mint',
    {
      to: deployer.address,
      tokenIds: [1, 2],
      amounts: ['100', '200']
    },
    'POST /api/token/batch-mint (MINTER_ROLE)'
  );
  
  // Burn tokens (requires BURNER_ROLE or token ownership)
  logInfo('Testing POST /api/token/burn...');
  await testEndpoint(
    'POST',
    '/token/burn',
    {
      amount: '10'
    },
    'POST /api/token/burn'
  );
  
  // Pause (requires PAUSER_ROLE)
  logInfo('Testing POST /api/token/pause (requires PAUSER_ROLE)...');
  await testEndpoint(
    'POST',
    '/token/pause',
    null,
    'POST /api/token/pause (PAUSER_ROLE)'
  );
  
  // Unpause (requires PAUSER_ROLE)
  logInfo('Testing POST /api/token/unpause (requires PAUSER_ROLE)...');
  await testEndpoint(
    'POST',
    '/token/unpause',
    null,
    'POST /api/token/unpause (PAUSER_ROLE)'
  );
  
  // Set max supply (requires ADMIN_ROLE)
  logInfo('Testing POST /api/token/set-max-supply (requires ADMIN_ROLE)...');
  // Skip if already set
  const tokenInfo = await testEndpoint('GET', '/token/info', null, 'Check max supply');
  if (tokenInfo.success && !tokenInfo.data.data.maxSupplySet) {
    await testEndpoint(
      'POST',
      '/token/set-max-supply',
      {
        maxSupply: '1000000'
      },
      'POST /api/token/set-max-supply (ADMIN_ROLE)'
    );
  } else {
    logWarning('Max supply already set, skipping');
    results.skipped++;
  }
  
  // ==========================================
  // Staking Endpoints (Require Roles)
  // ==========================================
  log('\n💰 Testing Staking Endpoints with Roles\n', 'cyan');
  
  // Notify reward (requires REWARDS_DISTRIBUTOR_ROLE)
  logInfo('Testing POST /api/staking/notify-reward (requires REWARDS_DISTRIBUTOR_ROLE)...');
  await testEndpoint(
    'POST',
    '/staking/notify-reward',
    {
      amount: '1000'
    },
    'POST /api/staking/notify-reward (REWARDS_DISTRIBUTOR_ROLE)'
  );
  
  // Set reward duration (requires OPERATOR_ROLE)
  logInfo('Testing POST /api/staking/set-reward-duration (requires OPERATOR_ROLE)...');
  await testEndpoint(
    'POST',
    '/staking/set-reward-duration',
    {
      duration: 31536000 // 1 year in seconds
    },
    'POST /api/staking/set-reward-duration (OPERATOR_ROLE)'
  );
  
  // ==========================================
  // Persona Endpoints (Require Roles)
  // ==========================================
  log('\n👤 Testing Persona Endpoints with Roles\n', 'cyan');
  
  // Verify identity (requires VERIFIER_ROLE)
  logInfo('Testing POST /api/persona/verify-identity (requires VERIFIER_ROLE)...');
  await testEndpoint(
    'POST',
    '/persona/verify-identity',
    {
      user: deployer.address,
      platform: 'twitter',
      platformId: 'test_user_123',
      signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    },
    'POST /api/persona/verify-identity (VERIFIER_ROLE)'
  );
  
  // Create relationship (requires OPERATOR_ROLE)
  logInfo('Testing POST /api/persona/relationship (requires OPERATOR_ROLE)...');
  const testUser2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  await testEndpoint(
    'POST',
    '/persona/relationship',
    {
      user1: deployer.address,
      user2: testUser2,
      totalSupply: '1000',
      relationshipType: 1 // Mutual
    },
    'POST /api/persona/relationship (OPERATOR_ROLE)'
  );
  
  // Update reputation (requires OPERATOR_ROLE)
  logInfo('Testing POST /api/persona/update-reputation (requires OPERATOR_ROLE)...');
  // First get a relationship token ID
  const relationships = await testEndpoint('GET', `/persona/user-relationships/${deployer.address}`, null, 'Get relationship IDs');
  if (relationships.success && relationships.data.data.relationshipIds.length > 0) {
    const tokenId = relationships.data.data.relationshipIds[0];
    await testEndpoint(
      'POST',
      '/persona/update-reputation',
      {
        tokenId: tokenId,
        newScore: 85
      },
      'POST /api/persona/update-reputation (OPERATOR_ROLE)'
    );
  } else {
    logWarning('No relationships found, skipping reputation update');
    results.skipped++;
  }
}

async function main() {
  log('\n🚀 Role Assignment and Endpoint Testing\n', 'blue');
  log('='.repeat(60), 'blue');
  
  try {
    // Step 1: Assign roles
    const roleAssignments = await assignRoles();
    
    // Step 2: Wait a bit for roles to propagate
    logInfo('Waiting for roles to propagate...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Test role-based endpoints
    await testRoleBasedEndpoints();
    
    // Step 4: Summary
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
    log('\n✅ Role assignment and testing complete!\n', 'green');
    
    process.exit(results.failed > 0 ? 1 : 0);
    
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();

