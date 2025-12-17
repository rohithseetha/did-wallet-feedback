#!/bin/bash
# Deploy contracts script - sets up Hardhat and deploys

set -e

cd "$(dirname "$0")"

echo "🔧 Setting up Hardhat..."

# Copy Hardhat from global installation
mkdir -p node_modules/hardhat node_modules/.bin
cp -r /home/charry/.nvm/versions/node/v22.14.0/lib/node_modules/hardhat/* node_modules/hardhat/ 2>/dev/null || true
cp /home/charry/.nvm/versions/node/v22.14.0/bin/hardhat node_modules/.bin/hardhat 2>/dev/null || true

# Install missing dependencies
echo "📦 Installing dependencies..."
npm install semver @nomiclabs/hardhat-ethers@2.2.3 --save-dev --legacy-peer-deps 2>&1 | tail -3

# Ensure config is correct
sed -i '1s/.*/require("@nomiclabs\/hardhat-ethers");/' hardhat.config.js

echo "✅ Setup complete!"
echo ""
echo "🚀 Deploying Token Economy Contracts..."
npx hardhat run scripts/deploy-token-economy.js --network localhost

echo ""
echo "🚀 Deploying Feedback Contract..."
npx hardhat run scripts/deploy-feedback.js --network localhost

echo ""
echo "✅ Deployment complete! Check deployments.json for addresses."

