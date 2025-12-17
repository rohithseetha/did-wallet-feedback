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

if (!MAIN_PRIVATE_KEY) {
  console.error('❌ MAIN_PRIVATE_KEY or PRIVATE_KEY not found in .env');
  process.exit(1);
}

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
const mainWallet = new ethers.Wallet(MAIN_PRIVATE_KEY, provider);
const aliceWallet = ALICE_PRIVATE_KEY ? new ethers.Wallet(ALICE_PRIVATE_KEY, provider) : null;
const bobWallet = BOB_PRIVATE_KEY ? new ethers.Wallet(BOB_PRIVATE_KEY, provider) : null;
const charlieWallet = CHARLIE_PRIVATE_KEY ? new ethers.Wallet(CHARLIE_PRIVATE_KEY, provider) : null;
const distWallet = DIST_PRIVATE_KEY ? new ethers.Wallet(DIST_PRIVATE_KEY, provider) : null;

// Load contract addresses and ABIs
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

// Load contract ABIs
const TokenABI = require('./artifacts/src/contracts/CentomilaContractV2.sol/CentomilaContractV2.json').abi;
const StakingABI = require('./artifacts/src/contracts/StakingContractV2.sol/StakingContractV2.json').abi;
const PersonaABI = require('./artifacts/src/contracts/PersonaContractV2.sol/PersonaContractV2.json').abi;

// Colors
const colors = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) { log(`✅ ${message}`, 'green'); }
function logError(message) { log(`❌ ${message}`, 'red'); }
function logInfo(message) { log(`ℹ️  ${message}`, 'cyan'); }
function logWarning(message) { log(`⚠️  ${message}`, 'yellow'); }
function logSection(message) {
  log(`\n${'='.repeat(70)}`, 'blue');
  log(`${message}`, 'bright');
  log('='.repeat(70), 'blue');
}

// Wait for transaction confirmation
async function waitForTransaction(txHash, maxWait = 60000) {
  if (!txHash) return null;
  
  const startTime = Date.now();
  logInfo(`Waiting for transaction ${txHash.substring(0, 10)}...`);
  
  while (Date.now() - startTime < maxWait) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt && receipt.blockNumber) {
        logSuccess(`Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed.toString()})`);
        return receipt;
      }
    } catch (error) {
      // Transaction not mined yet
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.stdout.write('.');
  }
  console.log('');
  logWarning(`Transaction not confirmed within ${maxWait/1000}s (may still be pending)`);
  return null;
}

// Test endpoint and wait for confirmation
async function testEndpoint(name, method, endpoint, data = null, retries = 0) {
  logSection(`Testing: ${name}`);
  
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    };

    if (data) {
      config.data = data;
    }

    logInfo(`Request: ${method} ${endpoint}`);
    if (data) {
      const displayData = { ...data };
      if (displayData.signature) displayData.signature = displayData.signature.substring(0, 20) + '...';
      logInfo(`Payload: ${JSON.stringify(displayData, null, 2)}`);
    }

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
        
        const receipt = await waitForTransaction(txHash, 60000);
        if (!receipt && retries < 2) {
          logWarning('Retrying...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          return testEndpoint(name, method, endpoint, data, retries + 1);
        }
      }
      
      logSuccess(`${name} - Status: ${response.status}, Time: ${duration}ms`);
      if (responseData && responseData.data) {
        const displayData = { ...responseData.data };
        if (displayData.transactionHash) {
          logInfo(`TX: ${displayData.transactionHash}`);
          logInfo(`Block: ${displayData.blockNumber || 'N/A'}`);
        }
      }
      
      // Wait before next request
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return { success: true, response: responseData, txHash };
    } else {
      logError(`${name} - Unexpected status: ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: false, error: `Status ${response.status}` };
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
    logError(`${name} - Error: ${errorMsg}`);
    
    // Check if it's an expected error
    const expectedErrors = [
      'Access denied',
      'missing role',
      'Insufficient balance',
      'Insufficient CENT balance',
      'No active stake',
      'Not following',
      'already set',
      'already exists'
    ];
    
    const isExpected = expectedErrors.some(e => errorMsg.toLowerCase().includes(e.toLowerCase()));
    if (isExpected) {
      logWarning(`Expected failure: ${errorMsg}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: false, expected: true, error: errorMsg };
    }
    
    // For unexpected errors, wait and continue
    await new Promise(resolve => setTimeout(resolve, 3000));
    return { success: false, error: errorMsg };
  }
}

// Grant role directly via contract
async function grantRole(contractAddress, contractABI, roleHash, account, wallet) {
  try {
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);
    const hasRole = await contract.hasRole(roleHash, account);
    
    if (hasRole) {
      logInfo(`Role already granted to ${account}`);
      return true;
    }
    
    logInfo(`Granting role to ${account}...`);
    const tx = await contract.grantRole(roleHash, account);
    logInfo(`Transaction: ${tx.hash}`);
    const receipt = await waitForTransaction(tx.hash, 60000);
    
    if (receipt) {
      logSuccess(`Role granted successfully`);
      return true;
    }
    return false;
  } catch (error) {
    logError(`Failed to grant role: ${error.message}`);
    return false;
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
  logInfo(`Main Account: ${mainWallet.address}`);
  if (aliceWallet) logInfo(`Alice Account: ${aliceWallet.address}`);
  if (bobWallet) logInfo(`Bob Account: ${bobWallet.address}`);
  if (charlieWallet) logInfo(`Charlie Account: ${charlieWallet.address}`);
  if (distWallet) logInfo(`Distributor Account: ${distWallet.address}`);
  
  // Check API server
  try {
    await axios.get(`${API_BASE_URL.replace('/api', '')}`, { timeout: 5000 });
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

  // STEP 1: Grant necessary roles to main account
  logSection('STEP 1: GRANTING ROLES');
  
  const tokenAddress = contracts.CentomilaContractV2?.address;
  const stakingAddress = contracts.StakingContractV2?.address;
  const personaAddress = contracts.PersonaContractV2?.address;
  
  if (tokenAddress) {
    const MINTER_ROLE = getRoleHash('MINTER_ROLE');
    const BURNER_ROLE = getRoleHash('BURNER_ROLE');
    const PAUSER_ROLE = getRoleHash('PAUSER_ROLE');
    const ADMIN_ROLE = getRoleHash('DEFAULT_ADMIN_ROLE');
    
    // Check if main account has admin role
    const tokenContract = new ethers.Contract(tokenAddress, TokenABI, provider);
    const hasAdmin = await tokenContract.hasRole(ADMIN_ROLE, mainWallet.address);
    
    if (hasAdmin) {
      logInfo('Main account has ADMIN_ROLE, granting MINTER_ROLE...');
      await grantRole(tokenAddress, TokenABI, MINTER_ROLE, mainWallet.address, mainWallet);
      await grantRole(tokenAddress, TokenABI, BURNER_ROLE, mainWallet.address, mainWallet);
      await grantRole(tokenAddress, TokenABI, PAUSER_ROLE, mainWallet.address, mainWallet);
    } else {
      logWarning('Main account does not have ADMIN_ROLE - some operations may fail');
    }
  }

  // STEP 2: TOKEN ENDPOINTS
  logSection('STEP 2: TOKEN ENDPOINTS');
  
  // 1. Approve-all (CRITICAL)
  if (stakingAddress && mainWallet) {
    const result = await testEndpoint(
      'POST /api/token/approve-all',
      'POST',
      '/token/approve-all',
      { operator: stakingAddress, approved: true }
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // 2. Mint tokens to Alice
  if (mainWallet && aliceWallet) {
    const result = await testEndpoint(
      'POST /api/token/mint',
      'POST',
      '/token/mint',
      {
        to: aliceWallet.address,
        tokenId: 1,
        amount: '1000'
      }
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // 3. Mint tokens to Main (for staking)
  if (mainWallet) {
    const result = await testEndpoint(
      'POST /api/token/mint (to main)',
      'POST',
      '/token/mint',
      {
        to: mainWallet.address,
        tokenId: 1,
        amount: '5000'
      }
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // 4. Transfer from Main to Bob
  if (mainWallet && bobWallet) {
    const result = await testEndpoint(
      'POST /api/token/transfer',
      'POST',
      '/token/transfer',
      {
        to: bobWallet.address,
        tokenId: 1,
        amount: '100'
      }
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // STEP 3: PERSONA ENDPOINTS
  logSection('STEP 3: PERSONA ENDPOINTS');
  
  // 5. Create profile for Main
  if (mainWallet) {
    const result = await testEndpoint(
      'POST /api/persona/profile',
      'POST',
      '/persona/profile',
      {
        name: 'Main User',
        bio: 'Main account profile',
        avatar: 'https://example.com/main.png'
      }
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // 6. Create profile for Alice
  if (aliceWallet) {
    const result = await testEndpoint(
      'POST /api/persona/profile (alice)',
      'POST',
      '/persona/profile',
      {
        name: 'Alice User',
        bio: 'Alice account profile',
        avatar: 'https://example.com/alice.png'
      }
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // 7. Follow Alice (from Main)
  if (mainWallet && aliceWallet) {
    const result = await testEndpoint(
      'POST /api/persona/follow',
      'POST',
      '/persona/follow',
      {
        following: aliceWallet.address
      }
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // STEP 4: STAKING ENDPOINTS
  logSection('STEP 4: STAKING ENDPOINTS');
  
  // 8. Stake tokens
  if (mainWallet) {
    const result = await testEndpoint(
      'POST /api/staking/stake',
      'POST',
      '/staking/stake',
      {
        amount: '1000'
      }
    );
    if (result.success) results.passed++;
    else if (result.expected) results.expected++;
    else results.failed++;
  }

  // STEP 5: FEEDBACK ENDPOINTS
  logSection('STEP 5: FEEDBACK ENDPOINTS');
  
  // 9. Submit feedback
  if (mainWallet && aliceWallet) {
    // Create a valid signature
    const payload = JSON.stringify({
      message: 'Excellent service!',
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
        message: 'Excellent service!',
        submitterDid: `did:ethr:${mainWallet.address}`,
        receiverDid: `did:ethr:${aliceWallet.address}`,
        rating: 5,
        signature: signature
      }
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
  logInfo(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  logSection('Test completed');
}

main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

