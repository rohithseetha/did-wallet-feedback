#!/bin/bash
# Setup Hardhat symlinks and deploy contracts

cd "$(dirname "$0")"

# Create symlinks to global Hardhat installation
echo "Setting up Hardhat symlinks..."
mkdir -p node_modules/hardhat node_modules/.bin
ln -sf /home/charry/.nvm/versions/node/v22.14.0/lib/node_modules/hardhat/* node_modules/hardhat/ 2>/dev/null
ln -sf /home/charry/.nvm/versions/node/v22.14.0/lib/node_modules/hardhat node_modules/hardhat 2>/dev/null
ln -sf /home/charry/.nvm/versions/node/v22.14.0/bin/hardhat node_modules/.bin/hardhat

# Ensure config uses @nomiclabs
sed -i '1s/.*/require("@nomiclabs\/hardhat-ethers");/' hardhat.config.js

# Install missing packages
echo "Installing dependencies..."
npm install @nomiclabs/hardhat-ethers@2.2.3 --save-dev --legacy-peer-deps 2>&1 | tail -3

# Deploy contracts
echo "Deploying token economy contracts..."
npx hardhat run scripts/deploy-token-economy.js --network localhost

echo "Deploying Feedback contract..."
npx hardhat run scripts/deploy-feedback.js --network localhost

