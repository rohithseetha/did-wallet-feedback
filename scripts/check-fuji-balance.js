const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("\n💰 Checking Fuji Testnet Balances\n");
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
  
  console.log(`\n📋 Account Information:`);
  console.log(`   Address: ${address}`);
  if (MAIN_PUBLIC_KEY) {
    const matches = address.toLowerCase() === MAIN_PUBLIC_KEY.toLowerCase().replace(/^0x/, '') || 
                    address.toLowerCase() === `0x${MAIN_PUBLIC_KEY.toLowerCase().replace(/^0x/, '')}`;
    console.log(`   MAIN_PUBLIC_KEY matches: ${matches ? '✅' : '❌'}`);
    if (!matches) {
      console.log(`   Expected: ${MAIN_PUBLIC_KEY}`);
      console.log(`   Actual:   ${address}`);
    }
  }
  
  // Check balance
  const balance = await provider.getBalance(address);
  const balanceAVAX = ethers.formatEther(balance);
  
  console.log(`\n💰 Balance:`);
  console.log(`   ${balanceAVAX} AVAX`);
  console.log(`   ${balance.toString()} wei`);
  
  // Check if balance is sufficient (need at least 0.1 AVAX for deployment)
  const minRequired = ethers.parseEther("0.1");
  const hasEnough = balance >= minRequired;
  
  console.log(`\n${hasEnough ? '✅' : '⚠️'} Status:`);
  if (hasEnough) {
    console.log(`   Sufficient balance for deployment and transactions`);
  } else {
    console.log(`   ⚠️  Low balance! Need at least 0.1 AVAX for deployment`);
    console.log(`\n📝 To get testnet AVAX:`);
    console.log(`   1. Visit: https://faucet.avax.network/`);
    console.log(`   2. Enter your address: ${address}`);
    console.log(`   3. Complete the captcha and request AVAX`);
    console.log(`\n   Or use another faucet:`);
    console.log(`   - https://faucet.quicknode.com/avalanche/fuji`);
    console.log(`   - https://app.moonpay.com/buy/avax-testnet`);
  }
  
  console.log("\n" + "=".repeat(70) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

