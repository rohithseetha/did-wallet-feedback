#!/bin/bash
# Deploy contracts to Fuji testnet

set -e

echo "🚀 Deploying Contracts to Fuji Testnet"
echo "======================================"
echo ""

# Check for MAIN_PRIVATE_KEY
if [ -z "$MAIN_PRIVATE_KEY" ]; then
  echo "❌ Error: MAIN_PRIVATE_KEY not set"
  echo "Please set MAIN_PRIVATE_KEY in your .env file or export it:"
  echo "  export MAIN_PRIVATE_KEY='0x...'"
  exit 1
fi

# Check for MAIN_PUBLIC_KEY
if [ -z "$MAIN_PUBLIC_KEY" ]; then
  echo "⚠️  Warning: MAIN_PUBLIC_KEY not set"
  echo "Will derive from MAIN_PRIVATE_KEY"
fi

echo "✅ MAIN_PRIVATE_KEY found"
echo ""

# Set network to fuji
export NETWORK=fuji

echo "📋 Deploying Token Economy Contracts..."
npx hardhat run scripts/deploy-token-economy.js --network fuji

echo ""
echo "📋 Deploying Feedback Contract..."
npx hardhat run scripts/deploy-feedback.js --network fuji

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Contract addresses saved to deployments.json"
echo ""
echo "Next steps:"
echo "1. Start API server: MAIN_PRIVATE_KEY='...' MAIN_PUBLIC_KEY='...' NETWORK=fuji npm start"
echo "2. Run tests: node test-fuji-testnet.js"

