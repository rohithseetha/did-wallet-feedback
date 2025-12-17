const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Send test AVAX from one account to another on Fuji testnet
 * This is useful if you have multiple accounts and need to fund one
 */
async function main() {
  console.log("\n💸 Send Test AVAX on Fuji Testnet\n");
  console.log("=".repeat(70));
  
  const FROM_PRIVATE_KEY = process.env.MAIN_PRIVATE_KEY;
  const TO_ADDRESS = process.env.MAIN_PUBLIC_KEY || process.argv[2];
  const AMOUNT = process.argv[3] || "0.5"; // Default 0.5 AVAX
  
  if (!FROM_PRIVATE_KEY) {
    console.error("❌ MAIN_PRIVATE_KEY not found in .env");
    process.exit(1);
  }
  
  if (!TO_ADDRESS) {
    console.error("❌ Recipient address not provided");
    console.log("Usage: node scripts/send-test-avax.js [to_address] [amount_in_avax]");
    console.log("Or set MAIN_PUBLIC_KEY in .env");
    process.exit(1);
  }
  
  // Connect to Fuji testnet
  const provider = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
  const wallet = new ethers.Wallet(FROM_PRIVATE_KEY, provider);
  const fromAddress = wallet.address;
  
  console.log(`\n📋 Transaction Details:`);
  console.log(`   From: ${fromAddress}`);
  console.log(`   To:   ${TO_ADDRESS}`);
  console.log(`   Amount: ${AMOUNT} AVAX`);
  
  // Check balance
  const balance = await provider.getBalance(fromAddress);
  const balanceAVAX = ethers.formatEther(balance);
  console.log(`   Sender Balance: ${balanceAVAX} AVAX`);
  
  const amountWei = ethers.parseEther(AMOUNT);
  
  if (balance < amountWei) {
    console.error(`\n❌ Insufficient balance!`);
    console.error(`   Need: ${AMOUNT} AVAX`);
    console.error(`   Have: ${balanceAVAX} AVAX`);
    process.exit(1);
  }
  
  // Estimate gas
  const gasPrice = await provider.getFeeData();
  const estimatedGas = 21000n; // Standard transfer
  const gasCost = gasPrice.gasPrice * estimatedGas;
  const totalCost = amountWei + gasCost;
  
  if (balance < totalCost) {
    console.error(`\n❌ Insufficient balance for gas!`);
    console.error(`   Need: ${ethers.formatEther(totalCost)} AVAX (including gas)`);
    console.error(`   Have: ${balanceAVAX} AVAX`);
    process.exit(1);
  }
  
  console.log(`\n⛽ Gas Estimate: ${ethers.formatEther(gasCost)} AVAX`);
  console.log(`   Total Cost: ${ethers.formatEther(totalCost)} AVAX`);
  
  // Send transaction
  console.log(`\n📤 Sending transaction...`);
  try {
    const tx = await wallet.sendTransaction({
      to: TO_ADDRESS,
      value: amountWei
    });
    
    console.log(`   Transaction Hash: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    
    console.log(`\n✅ Transaction confirmed!`);
    console.log(`   Block Number: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    
    // Check new balance
    const newBalance = await provider.getBalance(TO_ADDRESS);
    console.log(`\n💰 Recipient new balance: ${ethers.formatEther(newBalance)} AVAX`);
    
  } catch (error) {
    console.error(`\n❌ Transaction failed: ${error.message}`);
    process.exit(1);
  }
  
  console.log("\n" + "=".repeat(70) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

