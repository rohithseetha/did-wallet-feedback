const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:3000/api';
const TEST_ADDRESS_2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

// Load contract addresses
function loadContractAddresses() {
  const deploymentsPath = path.join(__dirname, 'deployments.json');
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  const networkData = deployments.networks.fuji;
  return networkData.contracts;
}

const contracts = loadContractAddresses();

async function testFailedEndpoints() {
  console.log('🔍 Analyzing Failed Test Cases\n');
  console.log('='.repeat(70));
  
  const tests = [
    {
      name: 'POST /api/token/transfer',
      method: 'POST',
      endpoint: '/token/transfer',
      data: {
        to: TEST_ADDRESS_2,
        tokenId: 1,
        amount: '100000000000000000' // 0.1 token
      }
    },
    {
      name: 'POST /api/token/burn',
      method: 'POST',
      endpoint: '/token/burn',
      data: {
        amount: '100000000000000000'
      }
    },
    {
      name: 'POST /api/token/set-max-supply',
      method: 'POST',
      endpoint: '/token/set-max-supply',
      data: {
        maxSupply: '1000000000000000000000000'
      }
    },
    {
      name: 'POST /api/staking/stake',
      method: 'POST',
      endpoint: '/staking/stake',
      data: {
        amount: '1000000000000000000'
      }
    },
    {
      name: 'POST /api/staking/cooldown',
      method: 'POST',
      endpoint: '/staking/cooldown',
      data: null
    },
    {
      name: 'POST /api/staking/unstake',
      method: 'POST',
      endpoint: '/staking/unstake',
      data: null
    },
    {
      name: 'POST /api/staking/claim',
      method: 'POST',
      endpoint: '/staking/claim-rewards',
      data: null
    },
    {
      name: 'POST /api/staking/notify-reward',
      method: 'POST',
      endpoint: '/staking/notify-reward',
      data: {
        reward: '1000000000000000000'
      }
    },
    {
      name: 'POST /api/persona/update-reputation',
      method: 'POST',
      endpoint: '/persona/update-reputation',
      data: {
        address: TEST_ADDRESS_2,
        reputation: 10
      }
    },
    {
      name: 'GET /api/did/balance/:address',
      method: 'GET',
      endpoint: `/did/balance/${process.env.MAIN_PUBLIC_KEY || '0xD20F07a5963dD8eD983DCc516D50Ad1a3dF1D209'}`,
      data: null
    }
  ];

  for (const test of tests) {
    console.log(`\n📋 Testing: ${test.name}`);
    try {
      const config = {
        method: test.method,
        url: `${API_BASE_URL}${test.endpoint}`,
        timeout: 30000
      };
      
      if (test.data) {
        config.data = test.data;
      }

      const response = await axios(config);
      console.log(`✅ Success: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
      const errorData = error.response?.data;
      console.log(`❌ Error: ${errorData?.error || error.message}`);
      if (errorData?.details) {
        console.log(`   Details: ${errorData.details.substring(0, 200)}`);
      }
      if (error.response?.status) {
        console.log(`   Status: ${error.response.status}`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testFailedEndpoints().catch(console.error);

