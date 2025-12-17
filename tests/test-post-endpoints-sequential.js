const axios = require('axios');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const NETWORK = process.env.NETWORK || 'fuji';

// Load accounts from .env
const MAIN_PRIVATE_KEY = process.env.MAIN_PRIVATE_KEY || process.env.PRIVATE_KEY;
const ALICE_PRIVATE_KEY = process.env.ALICE_PRIVATE_KEY;
const BOB_PRIVATE_KEY = process.env.BOB_PRIVATE_KEY;
const CHARLIE_PRIVATE_KEY = process.env.CHARLIE_PRIVATE_KEY;
const DIST_PRIVATE_KEY = process.env.DIST_PRIVATE_KEY;

// Get provider
function getProvider() {
  if (NETWORK === 'fuji') {
    return new ethers.JsonRpcProvider(process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc');
  } else if (NETWORK === 'localhost' || NETWORK === 'hardhat') {
    return new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  }
  return new ethers.JsonRpcProvider('http://127.0.0.1:8545');
}

const provider = getProvider();

// Create wallets
const mainWallet = MAIN_PRIVATE_KEY ? new ethers.Wallet(MAIN_PRIVATE_KEY, provider) : null;
const aliceWallet = ALICE_PRIVATE_KEY ? new ethers.Wallet(ALICE_PRIVATE_KEY, provider) : null;
const bobWallet = BOB_PRIVATE_KEY ? new ethers.Wallet(BOB_PRIVATE_KEY, provider) : null;
const charlieWallet = CHARLIE_PRIVATE_KEY ? new ethers.Wallet(CHARLIE_PRIVATE_KEY, provider) : null;
const distWallet = DIST_PRIVATE_KEY ? new ethers.Wallet(DIST_PRIVATE_KEY, provider) : null;

// Load contract addresses
function loadContractAddresses() {
  const deploymentsPath = path.join(__dirname, 'deployments.json');
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error('deployments.json not found');
  }
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  const networkData = deployments.networks[NETWORK];
  if (!networkData) {
    throw new Error(`Network ${NETWORK} not found in deployments.json`);
  }
  return networkData.contracts;
}

const contracts = loadContractAddresses();

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
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

function logSection(message) {
  log(`\n${'='.repeat(70)}`, 'blue');
  log(`${message}`, 'bright');
  log('='.repeat(70), 'blue');
}

// Wait for transaction confirmation
async function waitForTransaction(txHash, maxWait = 30000) {
  if (!txHash) return null;
  
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt && receipt.blockNumber) {
        return receipt;
      }
    } catch (error) {
      // Transaction not mined yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return null;
}

// Test endpoint and wait for confirmation
async function testEndpoint(name, method, endpoint, data = null, useAccount = 'main') {
  logSection(`Testing: ${name}`);
  
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    };

    if (data) {
      config.data = data;
    }

    logInfo(`Request: ${method} ${endpoint}`);
    if (data) {
      logInfo(`Payload: ${JSON.stringify(data, null, 2)}`);
    }
    logInfo(`Using account: ${useAccount}`);

    const startTime = Date.now();
    const response = await axios(config);
    const duration = Date.now() - startTime;

    if (response.status >= 200 && response.status < 300) {
      const responseData = response.data;
      
      // Check if there's a transaction hash
      let txHash = null;
      if (responseData && responseData.data && responseData.data.transactionHash) {
        txHash = responseData.data.transactionHash;
        logInfo(`Transaction Hash: ${txHash}`);
        logInfo(`Waiting for confirmation...`);
        
        const receipt = await waitForTransaction(txHash, 30000);
        if (receipt) {
          logSuccess(`Transaction confirmed in block ${receipt.blockNumber}`);
          logSuccess(`Gas Used: ${receipt.gasUsed.toString()}`);
        } else {
          logWarning(`Transaction not confirmed within timeout (may still be pending)`);
        }
      }
      
      logSuccess(`${name} - Status: ${response.status}, Time: ${duration}ms`);
      if (responseData && responseData.data) {
        logInfo(`Response: ${JSON.stringify(responseData.data, null, 2)}`);
      }
      
      // Wait a bit before next request to avoid nonce issues
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return { success: true, response: responseData, txHash };
    } else {
      logError(`${name} - Unexpected status: ${response.status}`);
      return { success: false, error: `Status ${response.status}` };
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
    logError(`${name} - Error: ${errorMsg}`);
    
    // Don't fail the test for expected errors (like missing roles, insufficient balance)
    const expectedErrors = [
      'Access denied',
      'missing role',
      'Insufficient balance',
      'Insufficient CENT balance',
      'No active stake',
      'Not following'
    ];
    
    const isExpected = expectedErrors.some(e => errorMsg.includes(e));
    if (isExpected) {
      logWarning(`Expected failure: ${errorMsg}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: false, expected: true, error: errorMsg };
    }
    
    // Wait before retrying or moving on
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: false, error: errorMsg };
  }
}

// Get role hash
function getRoleHash(roleName) {
  return ethers.keccak256(ethers.toUtf8Bytes(roleName));
}

async function main() {
  logSection('POST ENDPOINT TESTING - SEQUENTIAL WITH CONFIRMATION');
  logInfo(`Network: ${NETWORK}`);
  logInfo(`API Base URL: ${API_BASE_URL}`);
  logInfo(`Main Account: ${mainWallet?.address || 'N/A'}`);
  logInfo(`Alice Account: ${aliceWallet?.address || 'N/A'}`);
  logInfo(`Bob Account: ${bobWallet?.address || 'N/A'}`);
  logInfo(`Charlie Account: ${charlieWallet?.address || 'N/A'}`);
  logInfo(`Distributor Account: ${distWallet?.address || 'N/A'}`);
  
  // Check API server
  try {
    await axios.get(`${API_BASE_URL.replace('/api', '')}`);
    logSuccess('API server is running');
  } catch (error) {
    logError('API server is not running. Please start it first.');
    process.exit(1);
  }

  const results = {
    passed: 0,
    failed: 0,
    expected: 0
  };

  // TOKEN ENDPOINTS
  logSection('TOKEN ENDPOINTS');
  
  // 1. Approve-all (CRITICAL)
  const stakingAddress = contracts.StakingContractV2?.address;
  if (stakingAddress && mainWallet) {
    const result = await testEndpoint(
      'POST /api/token/approve-all',
      'POST',
      '/token/approve-all',
      { operator: stakingAddress, approved: true },
      'main'
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // 2. Mint tokens (need MINTER_ROLE - will likely fail, but test the endpoint)
  if (mainWallet && aliceWallet) {
    const result = await testEndpoint(
      'POST /api/token/mint',
      'POST',
      '/token/mint',
      {
        to: aliceWallet.address,
        tokenId: 1,
        amount: '100'
      },
      'main'
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // 3. Transfer tokens (if we have tokens)
  if (mainWallet && aliceWallet && bobWallet) {
    const result = await testEndpoint(
      'POST /api/token/transfer',
      'POST',
      '/token/transfer',
      {
        to: bobWallet.address,
        tokenId: 1,
        amount: '10'
      },
      'main'
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // PERSONA ENDPOINTS
  logSection('PERSONA ENDPOINTS');
  
  // 4. Create profile
  if (mainWallet) {
    const result = await testEndpoint(
      'POST /api/persona/profile',
      'POST',
      '/persona/profile',
      {
        name: 'Test User',
        bio: 'Test bio',
        avatar: 'https://example.com/avatar.png'
      },
      'main'
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // 5. Follow (if we have alice)
  if (mainWallet && aliceWallet) {
    const result = await testEndpoint(
      'POST /api/persona/follow',
      'POST',
      '/persona/follow',
      {
        following: aliceWallet.address
      },
      'main'
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // STAKING ENDPOINTS
  logSection('STAKING ENDPOINTS');
  
  // 6. Stake (need tokens first - will likely fail)
  if (mainWallet) {
    const result = await testEndpoint(
      'POST /api/staking/stake',
      'POST',
      '/staking/stake',
      {
        amount: '10'
      },
      'main'
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // FEEDBACK ENDPOINTS
  logSection('FEEDBACK ENDPOINTS');
  
  // 7. Submit feedback
  if (mainWallet && aliceWallet) {
    // Create a valid signature
    const payload = JSON.stringify({
      message: 'Great service!',
      submitterDid: `did:ethr:${mainWallet.address}`,
      receiverDid: `did:ethr:${aliceWallet.address}`,
      rating: 5
    });
    
    const signature = await mainWallet.signMessage(payload);
    
    const result = await testEndpoint(
      'POST /api/feedback/submit',
      'POST',
      '/feedback/submit',
      {
        message: 'Great service!',
        submitterDid: `did:ethr:${mainWallet.address}`,
        receiverDid: `did:ethr:${aliceWallet.address}`,
        rating: 5,
        signature: signature
      },
      'main'
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // SUMMARY
  logSection('TEST RESULTS SUMMARY');
  logSuccess(`Passed: ${results.passed}`);
  logWarning(`Expected Failures: ${results.expected}`);
  logError(`Failed: ${results.failed}`);
  logInfo(`Total: ${results.passed + results.expected + results.failed}`);
  
  logSection('Test completed');
}

main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

