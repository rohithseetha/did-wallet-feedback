#!/usr/bin/env node

/**
 * Test all endpoints using Hardhat node accounts
 * This script sets up the environment with Hardhat accounts and runs the tests
 */

const { HARDHAT_ACCOUNTS } = require('./scripts/setup-hardhat-accounts');

// Set environment variables to use Hardhat accounts
process.env.PRIVATE_KEY = HARDHAT_ACCOUNTS[0].privateKey;
process.env.TEST_ADDRESS = HARDHAT_ACCOUNTS[1].address;
process.env.TEST_ADDRESS_2 = HARDHAT_ACCOUNTS[2].address;
process.env.API_URL = process.env.API_URL || 'http://localhost:3000/api';
process.env.NETWORK = process.env.NETWORK || 'localhost';

console.log('\n🔧 Using Hardhat Node Accounts:');
console.log('='.repeat(70));
console.log(`PRIVATE_KEY: ${HARDHAT_ACCOUNTS[0].privateKey.substring(0, 20)}... (Account #0)`);
console.log(`Address: ${HARDHAT_ACCOUNTS[0].address}`);
console.log(`TEST_ADDRESS: ${HARDHAT_ACCOUNTS[1].address} (Account #1)`);
console.log(`TEST_ADDRESS_2: ${HARDHAT_ACCOUNTS[2].address} (Account #2)`);
console.log('='.repeat(70));
console.log('\n💡 These accounts have 10,000 ETH each from Hardhat node\n');

// Now run the test script
require('./test-all-endpoints.js');

