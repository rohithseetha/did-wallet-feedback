/**
 * Hardhat Node Default Accounts
 * These are the accounts created by: npx hardhat node
 * Each account has 10,000 ETH
 */

const HARDHAT_ACCOUNTS = [
  {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  },
  {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  },
  {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
  },
  {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
  },
  {
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f873f9c309c1a02b10f62"
  }
];

function getAccount(index = 0) {
  return HARDHAT_ACCOUNTS[index] || HARDHAT_ACCOUNTS[0];
}

function getAllAccounts() {
  return HARDHAT_ACCOUNTS;
}

// If run directly, print accounts
if (require.main === module) {
  console.log('\n📋 Hardhat Node Default Accounts\n');
  console.log('='.repeat(80));
  
  HARDHAT_ACCOUNTS.forEach((acc, idx) => {
    console.log(`\nAccount #${idx}:`);
    console.log(`  Address: ${acc.address}`);
    console.log(`  Private Key: ${acc.privateKey}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 To use in .env file, set:');
  console.log(`   PRIVATE_KEY=${HARDHAT_ACCOUNTS[0].privateKey}`);
  console.log(`   TEST_ADDRESS=${HARDHAT_ACCOUNTS[1].address}`);
  console.log(`   TEST_ADDRESS_2=${HARDHAT_ACCOUNTS[2].address}`);
  console.log('\n💡 Or export for current session:');
  console.log(`   export PRIVATE_KEY="${HARDHAT_ACCOUNTS[0].privateKey}"`);
  console.log(`   export TEST_ADDRESS="${HARDHAT_ACCOUNTS[1].address}"`);
  console.log(`   export TEST_ADDRESS_2="${HARDHAT_ACCOUNTS[2].address}"`);
  console.log('\n');
}

module.exports = { getAccount, getAllAccounts, HARDHAT_ACCOUNTS };

