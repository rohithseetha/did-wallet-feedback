const { ethers } = require("ethers");

/**
 * Get Hardhat node accounts (deterministic from mnemonic)
 * These are the accounts created by: npx hardhat node
 * Mnemonic: "test test test test test test test test test test test junk"
 */
function getHardhatAccounts() {
  const mnemonic = "test test test test test test test test test test test junk";
  const accounts = [];
  
  // Generate first 10 accounts (Hardhat node creates 20 by default)
  // Use Mnemonic class to properly derive accounts
  const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
  
  for (let i = 0; i < 10; i++) {
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonicObj.phrase, `m/44'/60'/0'/0/${i}`);
    accounts.push({
      index: i,
      address: hdNode.address,
      privateKey: hdNode.privateKey
    });
  }
  
  return accounts;
}

// If run directly, print accounts
if (require.main === module) {
  console.log('\n📋 Hardhat Node Accounts (from default mnemonic)\n');
  console.log('='.repeat(80));
  const accounts = getHardhatAccounts();
  
  accounts.forEach((acc, idx) => {
    console.log(`\nAccount #${idx}:`);
    console.log(`  Address: ${acc.address}`);
    console.log(`  Private Key: ${acc.privateKey}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 To use in .env file, set:');
  console.log(`   PRIVATE_KEY=${accounts[0].privateKey}`);
  console.log(`   TEST_ADDRESS=${accounts[1].address}`);
  console.log(`   TEST_ADDRESS_2=${accounts[2].address}`);
  console.log('\n');
}

module.exports = { getHardhatAccounts };

