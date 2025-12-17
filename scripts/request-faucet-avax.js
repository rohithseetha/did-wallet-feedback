const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

/**
 * Request testnet AVAX from faucets
 * This script provides instructions and can check if you've received AVAX
 */
async function main() {
  console.log("\n🚰 Requesting Testnet AVAX from Faucets\n");
  console.log("=".repeat(70));
  
  const MAIN_PRIVATE_KEY = process.env.MAIN_PRIVATE_KEY;
  const MAIN_PUBLIC_KEY = process.env.MAIN_PUBLIC_KEY;
  
  if (!MAIN_PRIVATE_KEY) {
    console.error("❌ MAIN_PRIVATE_KEY not found in .env");
    process.exit(1);
  }
  
  // Connect to Fuji testnet
  const provider = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
  const wallet = new ethers.Wallet(MAIN_PRIVATE_KEY, provider);
  const address = wallet.address;
  
  console.log(`\n📋 Your Address:`);
  console.log(`   ${address}`);
  
  // Check current balance
  const balance = await provider.getBalance(address);
  const balanceAVAX = ethers.formatEther(balance);
  console.log(`\n💰 Current Balance: ${balanceAVAX} AVAX`);
  
  // Check if balance is sufficient
  const minRecommended = ethers.parseEther("1.0"); // 1 AVAX recommended
  const hasEnough = balance >= minRecommended;
  
  if (hasEnough) {
    console.log(`\n✅ You have sufficient AVAX for testing!`);
    console.log(`   Current: ${balanceAVAX} AVAX`);
    console.log(`   Recommended: 1.0 AVAX`);
    console.log(`\n💡 If you're seeing 'insufficient funds' errors, they might be:`);
    console.log(`   - Gas estimation issues (normal)`);
    console.log(`   - Missing roles (AccessControl errors)`);
    console.log(`   - Contract state issues (not actual insufficient funds)`);
  } else {
    console.log(`\n⚠️  Low balance detected!`);
    console.log(`   Current: ${balanceAVAX} AVAX`);
    console.log(`   Recommended: 1.0 AVAX`);
    console.log(`\n📝 Request testnet AVAX from these faucets:\n`);
    
    console.log(`1. 🔵 Avalanche Official Faucet:`);
    console.log(`   URL: https://faucet.avax.network/`);
    console.log(`   Address: ${address}`);
    console.log(`   Steps:`);
    console.log(`     - Visit the URL`);
    console.log(`     - Enter your address`);
    console.log(`     - Complete captcha`);
    console.log(`     - Request AVAX\n`);
    
    console.log(`2. 🟢 QuickNode Faucet:`);
    console.log(`   URL: https://faucet.quicknode.com/avalanche/fuji`);
    console.log(`   Address: ${address}`);
    console.log(`   Steps:`);
    console.log(`     - Visit the URL`);
    console.log(`     - Connect wallet or enter address`);
    console.log(`     - Request AVAX\n`);
    
    console.log(`3. 🟡 MoonPay Testnet:`);
    console.log(`   URL: https://app.moonpay.com/buy/avax-testnet`);
    console.log(`   Note: This may require account setup\n`);
    
    console.log(`4. 🔴 Chainlink Faucet (if available):`);
    console.log(`   URL: https://faucets.chain.link/`);
    console.log(`   Select: Avalanche Fuji\n`);
  }
  
  console.log(`\n💡 Tips:`);
  console.log(`   - Most faucets have rate limits (once per 24 hours)`);
  console.log(`   - You can request from multiple faucets`);
  console.log(`   - Wait a few minutes after requesting for AVAX to arrive`);
  console.log(`   - Check balance with: node scripts/check-fuji-balance.js`);
  
  console.log("\n" + "=".repeat(70) + "\n");
  
  // Try to check if we can programmatically request (some faucets have APIs)
  console.log(`\n🔄 Checking if AVAX was received...`);
  console.log(`   (Run this script again after requesting from faucet to check)`);
  
  // Wait a moment and check again
  await new Promise(resolve => setTimeout(resolve, 2000));
  const newBalance = await provider.getBalance(address);
  const newBalanceAVAX = ethers.formatEther(newBalance);
  
  if (newBalance > balance) {
    const received = ethers.formatEther(newBalance - balance);
    console.log(`\n✅ Received ${received} AVAX!`);
    console.log(`   New balance: ${newBalanceAVAX} AVAX`);
  } else {
    console.log(`\n⏳ No new AVAX received yet.`);
    console.log(`   Please request from faucet and wait a few minutes.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

