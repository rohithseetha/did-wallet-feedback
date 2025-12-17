#!/bin/bash

# Script to run tests with Hardhat node accounts
# This ensures the API server uses an account with funds

set -e

echo "🚀 Setting up tests with Hardhat Node Accounts"
echo "================================================"
echo ""

# Load Hardhat accounts
HARDHAT_ACCOUNT_0="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
HARDHAT_ADDRESS_0="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
HARDHAT_ADDRESS_1="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
HARDHAT_ADDRESS_2="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

echo "📋 Hardhat Accounts:"
echo "  Account #0: $HARDHAT_ADDRESS_0 (has 10,000 ETH)"
echo "  Account #1: $HARDHAT_ADDRESS_1 (has 10,000 ETH)"
echo "  Account #2: $HARDHAT_ADDRESS_2 (has 10,000 ETH)"
echo ""

# Check if Hardhat node is running
echo "🔍 Checking Hardhat node..."
if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://127.0.0.1:8545 > /dev/null 2>&1; then
    echo "✅ Hardhat node is running on http://127.0.0.1:8545"
else
    echo "❌ Hardhat node is not running!"
    echo "   Please start it with: npx hardhat node"
    exit 1
fi

# Check if API server is running
echo "🔍 Checking API server..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ API server is running on http://localhost:3000"
    echo ""
    echo "⚠️  IMPORTANT: The API server needs to be restarted with the Hardhat account!"
    echo ""
    echo "   To use Hardhat accounts, restart the API server with:"
    echo "   PRIVATE_KEY=$HARDHAT_ACCOUNT_0 npm start"
    echo ""
    echo "   Or set in .env file:"
    echo "   PRIVATE_KEY=$HARDHAT_ACCOUNT_0"
    echo ""
    read -p "Continue with tests anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "❌ API server is not running!"
    echo "   Starting API server with Hardhat account..."
    echo ""
    PRIVATE_KEY=$HARDHAT_ACCOUNT_0 TEST_ADDRESS=$HARDHAT_ADDRESS_1 TEST_ADDRESS_2=$HARDHAT_ADDRESS_2 npm start &
    API_PID=$!
    echo "   API server started (PID: $API_PID)"
    echo "   Waiting for server to be ready..."
    sleep 5
    
    # Wait for server to be ready
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo "✅ API server is ready!"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "🧪 Running tests with Hardhat accounts..."
echo "=========================================="
echo ""

# Set environment variables and run tests
export PRIVATE_KEY=$HARDHAT_ACCOUNT_0
export TEST_ADDRESS=$HARDHAT_ADDRESS_1
export TEST_ADDRESS_2=$HARDHAT_ADDRESS_2
export API_URL=${API_URL:-"http://localhost:3000/api"}
export NETWORK=${NETWORK:-"localhost"}

node test-all-endpoints.js

# Cleanup if we started the server
if [ ! -z "$API_PID" ]; then
    echo ""
    echo "🛑 Stopping API server (PID: $API_PID)..."
    kill $API_PID 2>/dev/null || true
fi

