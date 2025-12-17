const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Get accounts from .env file
 * Returns signers for all accounts defined in .env
 */
async function getAccounts() {
  const {
    MAIN_PRIVATE_KEY,
    ALICE_PRIVATE_KEY,
    BOB_PRIVATE_KEY,
    CHARLIE_PRIVATE_KEY,
    DIST_PRIVATE_KEY,
    MAIN_PUBLIC_KEY,
    ALICE_PUBLIC_KEY,
    BOB_PUBLIC_KEY,
    CHARLIE_PUBLIC_KEY,
    DIST_PUBLIC_KEY
  } = process.env;

  // Get provider based on network
  const network = process.env.NETWORK || 'localhost';
  let provider;
  if (network === 'fuji') {
    provider = new ethers.JsonRpcProvider(process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc');
  } else if (network === 'avalanche') {
    provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc');
  } else {
    provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  }
  
  const accounts = {};

  // Main deployer account
  if (MAIN_PRIVATE_KEY) {
    accounts.deployer = new ethers.Wallet(MAIN_PRIVATE_KEY, provider);
    console.log(`✓ Loaded deployer: ${accounts.deployer.address}`);
  } else {
    throw new Error("MAIN_PRIVATE_KEY not found in .env");
  }

  // Alice
  if (ALICE_PRIVATE_KEY) {
    accounts.alice = new ethers.Wallet(ALICE_PRIVATE_KEY, provider);
    console.log(`✓ Loaded alice: ${accounts.alice.address}`);
  }

  // Bob
  if (BOB_PRIVATE_KEY) {
    accounts.bob = new ethers.Wallet(BOB_PRIVATE_KEY, provider);
    console.log(`✓ Loaded bob: ${accounts.bob.address}`);
  }

  // Charlie
  if (CHARLIE_PRIVATE_KEY) {
    accounts.charlie = new ethers.Wallet(CHARLIE_PRIVATE_KEY, provider);
    console.log(`✓ Loaded charlie: ${accounts.charlie.address}`);
  }

  // Distributor
  if (DIST_PRIVATE_KEY) {
    accounts.distributor = new ethers.Wallet(DIST_PRIVATE_KEY, provider);
    console.log(`✓ Loaded distributor: ${accounts.distributor.address}`);
  }

  // Verify addresses match if public keys are provided (case-insensitive)
  if (MAIN_PUBLIC_KEY) {
    const deployerAddr = accounts.deployer.address.toLowerCase();
    const mainAddr = MAIN_PUBLIC_KEY.toLowerCase().replace(/^0x/, '');
    if (deployerAddr !== `0x${mainAddr}` && deployerAddr !== mainAddr) {
      console.warn(`⚠️  MAIN_PUBLIC_KEY mismatch: ${accounts.deployer.address} vs ${MAIN_PUBLIC_KEY}`);
    } else {
      console.log(`✓ MAIN address verified: ${accounts.deployer.address}`);
    }
  }
  if (ALICE_PUBLIC_KEY && accounts.alice) {
    const aliceAddr = accounts.alice.address.toLowerCase();
    const alicePub = ALICE_PUBLIC_KEY.toLowerCase().replace(/^0x/, '');
    if (aliceAddr !== `0x${alicePub}` && aliceAddr !== alicePub) {
      console.warn(`⚠️  ALICE_PUBLIC_KEY mismatch: ${accounts.alice.address} vs ${ALICE_PUBLIC_KEY}`);
    }
  }
  if (BOB_PUBLIC_KEY && accounts.bob) {
    const bobAddr = accounts.bob.address.toLowerCase();
    const bobPub = BOB_PUBLIC_KEY.toLowerCase().replace(/^0x/, '');
    if (bobAddr !== `0x${bobPub}` && bobAddr !== bobPub) {
      console.warn(`⚠️  BOB_PUBLIC_KEY mismatch: ${accounts.bob.address} vs ${BOB_PUBLIC_KEY}`);
    }
  }
  if (CHARLIE_PUBLIC_KEY && accounts.charlie) {
    const charlieAddr = accounts.charlie.address.toLowerCase();
    const charliePub = CHARLIE_PUBLIC_KEY.toLowerCase().replace(/^0x/, '');
    if (charlieAddr !== `0x${charliePub}` && charlieAddr !== charliePub) {
      console.warn(`⚠️  CHARLIE_PUBLIC_KEY mismatch: ${accounts.charlie.address} vs ${CHARLIE_PUBLIC_KEY}`);
    }
  }
  if (DIST_PUBLIC_KEY && accounts.distributor) {
    const distAddr = accounts.distributor.address.toLowerCase();
    const distPub = DIST_PUBLIC_KEY.toLowerCase().replace(/^0x/, '');
    if (distAddr !== `0x${distPub}` && distAddr !== distPub) {
      console.warn(`⚠️  DIST_PUBLIC_KEY mismatch: ${accounts.distributor.address} vs ${DIST_PUBLIC_KEY}`);
    }
  }

  return accounts;
}

module.exports = { getAccounts };

