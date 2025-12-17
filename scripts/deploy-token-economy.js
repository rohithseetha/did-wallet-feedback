const hre = require("hardhat");
const { ethers } = require("hardhat");
const { getAccounts } = require("./get-accounts");
const fs = require("fs");
const path = require("path");

async function main() {
  // Use MAIN account from .env
  const accounts = await getAccounts();
  const deployer = accounts.deployer;
  
  console.log("\n📋 Using accounts from .env file");
  console.log("Deploying Centomila Token Economy with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "AVAX");
  
  if (balance === 0n) {
    console.warn("⚠️  WARNING: Deployer account has zero balance!");
  }
  
  // Metadata URI for ERC1155 tokens
  const METADATA_URI = process.env.METADATA_URI || "https://api.centomila.com/metadata/";
  
  // Deploy CentomilaContractV2
  console.log("\n1. Deploying CentomilaContractV2...");
  const CentomilaContractV2 = await hre.ethers.getContractFactory("CentomilaContractV2");
  const centomilaToken = await CentomilaContractV2.deploy(METADATA_URI);
  await centomilaToken.waitForDeployment();
  const centomilaAddress = await centomilaToken.getAddress();
  console.log("CentomilaContractV2 deployed to:", centomilaAddress);
  
  // Deploy StakingContractV2
  console.log("\n2. Deploying StakingContractV2...");
  const StakingContractV2 = await hre.ethers.getContractFactory("StakingContractV2");
  const stakingContract = await StakingContractV2.deploy(centomilaAddress);
  await stakingContract.waitForDeployment();
  const stakingAddress = await stakingContract.getAddress();
  console.log("StakingContractV2 deployed to:", stakingAddress);
  
  // Deploy PersonaContractV2
  console.log("\n3. Deploying PersonaContractV2...");
  const PersonaContractV2 = await hre.ethers.getContractFactory("PersonaContractV2");
  const personaContract = await PersonaContractV2.deploy(centomilaAddress);
  await personaContract.waitForDeployment();
  const personaAddress = await personaContract.getAddress();
  console.log("PersonaContractV2 deployed to:", personaAddress);
  
  // Grant roles
  console.log("\n4. Setting up roles...");
  const MINTER_ROLE = await centomilaToken.MINTER_ROLE();
  await centomilaToken.grantRole(MINTER_ROLE, stakingAddress);
  await centomilaToken.grantRole(MINTER_ROLE, personaAddress);
  console.log("Granted MINTER_ROLE to StakingContract and PersonaContract");
  
  const OPERATOR_ROLE = await personaContract.OPERATOR_ROLE();
  await personaContract.grantRole(OPERATOR_ROLE, deployer.address);
  console.log("Granted OPERATOR_ROLE to deployer");
  
  console.log("\n=== Deployment Summary ===");
  console.log("CentomilaContractV2:", centomilaAddress);
  console.log("StakingContractV2:", stakingAddress);
  console.log("PersonaContractV2:", personaAddress);
  const tokenId = await centomilaToken.CENT_TOKEN_ID();
  const decimals = await centomilaToken.DECIMALS();
  console.log("\nToken ID for CENT:", tokenId.toString());
  console.log("Decimals:", decimals.toString());
  console.log("APY:", "5%");
  console.log("Minimum Lock Period:", "30 days");
  console.log("Cooldown Period:", "7 days");
  console.log("Early Withdrawal Penalty:", "10%");
  
  // Save deployment addresses to deployments.json
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  
  let deployments = {};
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  } else {
    deployments = {
      networks: {
        localhost: { chainId: 1337, contracts: {}, roles: {} },
        fuji: { chainId: 43113, contracts: {}, roles: {} },
        avalanche: { chainId: 43114, contracts: {}, roles: {} },
        sepolia: { chainId: 11155111, contracts: {}, roles: {} },
        mainnet: { chainId: 1, contracts: {}, roles: {} }
      },
      lastUpdated: new Date().toISOString()
    };
  }
  
  const network = await hre.ethers.provider.getNetwork();
  const networkName = hre.network.name;
  const chainId = Number(network.chainId);
  const deployedAt = new Date().toISOString();
  
  // Initialize network if it doesn't exist
  if (!deployments.networks[networkName]) {
    deployments.networks[networkName] = { chainId, contracts: {}, roles: {} };
  }
  
  // Save contract addresses
  deployments.networks[networkName].chainId = chainId;
  deployments.networks[networkName].contracts = {
    CentomilaContractV2: {
      address: centomilaAddress,
      deployedAt,
      deployer: deployer.address,
      metadataURI: METADATA_URI,
      transactionHash: centomilaToken.deploymentTransaction()?.hash || ""
    },
    StakingContractV2: {
      address: stakingAddress,
      deployedAt,
      deployer: deployer.address,
      tokenAddress: centomilaAddress,
      transactionHash: stakingContract.deploymentTransaction()?.hash || ""
    },
    PersonaContractV2: {
      address: personaAddress,
      deployedAt,
      deployer: deployer.address,
      tokenAddress: centomilaAddress,
      transactionHash: personaContract.deploymentTransaction()?.hash || ""
    }
  };
  
  // Save role assignments
  deployments.networks[networkName].roles = {
    MINTER_ROLE: {
      StakingContractV2: stakingAddress,
      PersonaContractV2: personaAddress
    },
    OPERATOR_ROLE: {
      PersonaContractV2: deployer.address
    }
  };
  
  deployments.lastUpdated = deployedAt;
  
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("\n✓ Deployment addresses saved to deployments.json");
  
  // Also output deployment info
  const deploymentInfo = {
    network: networkName,
    chainId,
    contracts: {
      CentomilaContractV2: centomilaAddress,
      StakingContractV2: stakingAddress,
      PersonaContractV2: personaAddress
    },
    metadataURI: METADATA_URI,
    deployedAt
  };
  
  console.log("\n=== Deployment Info ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

