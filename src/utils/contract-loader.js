const fs = require('fs');
const path = require('path');
const ethers = require('ethers');

/**
 * Load contract addresses from deployments.json
 * Supports multiple networks and falls back to localhost if network not specified
 */
function loadContractAddresses(network = null) {
  const deploymentsPath = path.join(__dirname, '..', '..', 'deployments.json');
  
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error('deployments.json not found. Please deploy contracts first.');
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  
  // Determine network - use env var, parameter, or default to localhost
  const networkName = network || process.env.NETWORK || 'localhost';
  
  if (!deployments.networks[networkName]) {
    throw new Error(`Network ${networkName} not found in deployments.json`);
  }

  const networkData = deployments.networks[networkName];
  const contracts = networkData.contracts || {};

  return {
    network: networkName,
    chainId: networkData.chainId,
    contracts: {
      CentomilaContractV2: contracts.CentomilaContractV2?.address,
      StakingContractV2: contracts.StakingContractV2?.address,
      PersonaContractV2: contracts.PersonaContractV2?.address,
      Feedback: contracts.Feedback?.address
    }
  };
}

/**
 * Get provider based on network
 */
function getProvider(network = null) {
  const networkName = network || process.env.NETWORK || 'localhost';
  
  // Check if ethers v5 or v6
  const isV6 = typeof ethers.JsonRpcProvider !== 'undefined';
  const JsonRpcProvider = isV6 ? ethers.JsonRpcProvider : ethers.providers.JsonRpcProvider;
  
  // Localhost/Hardhat network
  if (networkName === 'localhost' || networkName === 'hardhat') {
    return new JsonRpcProvider('http://127.0.0.1:8545');
  }
  
  // Sepolia testnet
  if (networkName === 'sepolia') {
    if (!process.env.INFURA_PROJECT_ID) {
      throw new Error('INFURA_PROJECT_ID is required for Sepolia network');
    }
    return new JsonRpcProvider(
      `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
    );
  }
  
  // Avalanche Fuji testnet
  if (networkName === 'fuji') {
    return new JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
  }
  
  // Avalanche mainnet
  if (networkName === 'avalanche') {
    return new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
  }
  
  throw new Error(`Unsupported network: ${networkName}`);
}

module.exports = {
  loadContractAddresses,
  getProvider
};

