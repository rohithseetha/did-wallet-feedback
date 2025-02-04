# DID Wallet API

A Node.js backend service for managing Decentralized Identifiers (DIDs) and feedback on the Ethereum network.

## Prerequisites

- Docker
- Node.js 18+ (for local development)
- Ethereum wallet with some Sepolia testnet ETH
- Infura API key
- Environment variables setup

## Environment Variables

Create a `.env` file with the following variables:

```env
INFURA_PROJECT_ID=your_infura_project_id
PRIVATE_KEY=your_ethereum_private_key
FEEDBACK_CONTRACT_ADDRESS=deployed_contract_address
```

## Running with Docker

1. Build the Docker image:
```bash
docker build -t did-wallet-api .
```

2. Run the container:
```bash
docker run -p 3000:3000 --env-file .env did-wallet-api
```

The API will be available at `http://localhost:3000` and the Swagger documentation at `http://localhost:3000/api-docs`.

## API Testing Guide

### 1. Generate a DID

```bash
curl -X POST http://localhost:3000/api/did/generate
```

### 2. Sign a Message

Simple message:
```bash
curl -X POST http://localhost:3000/api/did/sign \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello World",
    "privateKey": "your_private_key"
  }'
```

Feedback payload:
```bash
curl -X POST http://localhost:3000/api/did/sign \
  -H "Content-Type: application/json" \
  -d '{
    "feedback": {
      "message": "Great service!",
      "submitterDid": "did:ethr:sepolia:0x...",
      "receiverDid": "did:ethr:sepolia:0x...",
      "rating": 5
    },
    "privateKey": "your_private_key"
  }'
```

### 3. Submit Feedback

```bash
curl -X POST http://localhost:3000/api/feedback/submit \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Great service!",
    "submitterDid": "did:ethr:sepolia:0x...",
    "receiverDid": "did:ethr:sepolia:0x...",
    "rating": 5,
    "signature": "0x..."
  }'
```

### 4. Get Feedback List

```bash
curl http://localhost:3000/api/feedback/list
```

### 5. Get Reputation

```bash
curl http://localhost:3000/api/feedback/reputation/did:ethr:sepolia:0x...
```

### 6. Check ETH Balance

```bash
curl http://localhost:3000/api/did/balance/0x...
```

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

## API Documentation

The API documentation is available through Swagger UI at `/api-docs` when the server is running. It provides detailed information about all available endpoints, request/response schemas, and example payloads.