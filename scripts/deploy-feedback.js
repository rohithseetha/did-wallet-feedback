const hre = require("hardhat");
const { ethers } = require("hardhat");
const { getAccounts } = require("./get-accounts");
const fs = require("fs");
const path = require("path");

async function main() {
  const accounts = await getAccounts();
  const deployer = accounts.deployer;
  
  console.log("\n📋 Deploying Feedback Contract");
  console.log("Deployer address:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();
  const networkName = hre.network.name;
  
  console.log("Network:", networkName, `(Chain ID: ${network.chainId})`);
  console.log("Balance:", ethers.formatEther(balance), 
    networkName === "fuji" || networkName === "avalanche" ? "AVAX" : "ETH");
  
  if (balance === 0n && networkName !== "localhost" && networkName !== "hardhat") {
    console.warn("⚠️  WARNING: Deployer account has zero balance!");
    return;
  }
  
  // Deploy Feedback contract
  console.log("\n1. Deploying Feedback contract...");
  const Feedback = await hre.ethers.getContractFactory("Feedback");
  const feedback = await Feedback.deploy();
  await feedback.waitForDeployment();
  const feedbackAddress = await feedback.getAddress();
  
  console.log("✅ Feedback deployed to:", feedbackAddress);
  
  // Save to deployments.json
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  
  let deployments = {};
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  } else {
    deployments = {
      networks: {},
      lastUpdated: new Date().toISOString()
    };
  }
  
  if (!deployments.networks[networkName]) {
    deployments.networks[networkName] = {
      chainId: Number(network.chainId),
      contracts: {},
      roles: {}
    };
  }
  
  deployments.networks[networkName].contracts.Feedback = {
    address: feedbackAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    transactionHash: feedback.deploymentTransaction()?.hash || ""
  };
  
  deployments.lastUpdated = new Date().toISOString();
  
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("\n✓ Deployment saved to deployments.json");
  
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", networkName);
  console.log("Feedback Contract:", feedbackAddress);
  console.log("\nNext steps:");
  console.log("1. Update FEEDBACK_CONTRACT_ADDRESS in .env file");
  console.log("2. Verify contract: npx hardhat run scripts/verify-contracts.js --network", networkName);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

