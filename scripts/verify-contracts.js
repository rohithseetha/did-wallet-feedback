const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const deploymentsPath = path.join(__dirname, "..", "deployments.json");

async function verifyContracts(networkName) {
  console.log(`\n🔍 Verifying contracts on ${networkName.toUpperCase()}\n`);
  console.log("=".repeat(60));
  
  // Load deployments
  if (!fs.existsSync(deploymentsPath)) {
    console.log("❌ deployments.json not found.");
    return;
  }
  
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const network = deployments.networks[networkName];
  
  if (!network || !network.contracts || Object.keys(network.contracts).length === 0) {
    console.log(`❌ No deployments found for network: ${networkName}`);
    return;
  }
  
  const contracts = network.contracts;
  
  // Verify CentomilaContractV2
  if (contracts.CentomilaContractV2) {
    console.log(`\n1. Verifying CentomilaContractV2...`);
    console.log(`   Address: ${contracts.CentomilaContractV2.address}`);
    try {
      await hre.run("verify:verify", {
        address: contracts.CentomilaContractV2.address,
        constructorArguments: [contracts.CentomilaContractV2.metadataURI || "https://api.centomila.com/metadata/"],
        network: networkName
      });
      console.log("   ✓ Verified");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("   ✓ Already verified");
      } else {
        console.log(`   ✗ Error: ${error.message}`);
      }
    }
  }
  
  // Verify StakingContractV2
  if (contracts.StakingContractV2) {
    console.log(`\n2. Verifying StakingContractV2...`);
    console.log(`   Address: ${contracts.StakingContractV2.address}`);
    try {
      await hre.run("verify:verify", {
        address: contracts.StakingContractV2.address,
        constructorArguments: [contracts.StakingContractV2.tokenAddress],
        network: networkName
      });
      console.log("   ✓ Verified");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("   ✓ Already verified");
      } else {
        console.log(`   ✗ Error: ${error.message}`);
      }
    }
  }
  
  // Verify PersonaContractV2
  if (contracts.PersonaContractV2) {
    console.log(`\n3. Verifying PersonaContractV2...`);
    console.log(`   Address: ${contracts.PersonaContractV2.address}`);
    try {
      await hre.run("verify:verify", {
        address: contracts.PersonaContractV2.address,
        constructorArguments: [contracts.PersonaContractV2.tokenAddress],
        network: networkName
      });
      console.log("   ✓ Verified");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("   ✓ Already verified");
      } else {
        console.log(`   ✗ Error: ${error.message}`);
      }
    }
  }
  
  // Verify Feedback
  if (contracts.Feedback) {
    console.log(`\n4. Verifying Feedback...`);
    console.log(`   Address: ${contracts.Feedback.address}`);
    try {
      await hre.run("verify:verify", {
        address: contracts.Feedback.address,
        constructorArguments: [], // Feedback contract has no constructor arguments
        network: networkName
      });
      console.log("   ✓ Verified");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("   ✓ Already verified");
      } else {
        console.log(`   ✗ Error: ${error.message}`);
      }
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Verification complete");
}

// CLI usage
const networkName = process.argv[2];

if (!networkName) {
  console.log("Usage: npx hardhat run scripts/verify-contracts.js --network <network>");
  console.log("Example: npx hardhat run scripts/verify-contracts.js --network fuji");
  process.exit(1);
}

verifyContracts(networkName)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

