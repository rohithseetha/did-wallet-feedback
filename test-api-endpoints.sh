#!/bin/bash

# Test script for new API endpoints
# Make sure the server is running: npm start

BASE_URL="http://localhost:3000/api"
WALLET_ADDRESS="0xD20F07a5963dD8eD983DCc516D50Ad1a3dF1D209"  # From deployments.json

echo "🧪 Testing New API Endpoints"
echo "============================"
echo ""

# Test Token endpoints
echo "1️⃣ Testing Token Endpoints"
echo "------------------------"
echo "GET $BASE_URL/token/info"
curl -s "$BASE_URL/token/info" | jq '.' || echo "Failed"
echo ""

echo "GET $BASE_URL/token/balance/$WALLET_ADDRESS"
curl -s "$BASE_URL/token/balance/$WALLET_ADDRESS" | jq '.' || echo "Failed"
echo ""

# Test Staking endpoints
echo "2️⃣ Testing Staking Endpoints"
echo "---------------------------"
echo "GET $BASE_URL/staking/contract-info"
curl -s "$BASE_URL/staking/contract-info" | jq '.' || echo "Failed"
echo ""

echo "GET $BASE_URL/staking/info/$WALLET_ADDRESS"
curl -s "$BASE_URL/staking/info/$WALLET_ADDRESS" | jq '.' || echo "Failed"
echo ""

# Test Persona endpoints
echo "3️⃣ Testing Persona Endpoints"
echo "---------------------------"
echo "GET $BASE_URL/persona/profile/$WALLET_ADDRESS"
curl -s "$BASE_URL/persona/profile/$WALLET_ADDRESS" | jq '.' || echo "Failed"
echo ""

echo "GET $BASE_URL/persona/relationships/$WALLET_ADDRESS"
curl -s "$BASE_URL/persona/relationships/$WALLET_ADDRESS" | jq '.' || echo "Failed"
echo ""

# Test Feedback endpoints (existing)
echo "4️⃣ Testing Feedback Endpoints (existing)"
echo "----------------------------------------"
echo "GET $BASE_URL/feedback/list"
curl -s "$BASE_URL/feedback/list" | jq '.' || echo "Failed"
echo ""

echo "✅ API endpoint tests complete!"
echo ""
echo "Note: POST endpoints require authentication and will be tested manually via Swagger UI"
echo "Visit: http://localhost:3000/api-docs"

