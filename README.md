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




### 1. **CentomilaContract.sol** (ERC-1155)
- CENT token (Token ID: 1, 18 decimals)
- Minting and burning
- Role-based access control

### 2. **StakingContract.sol**
- 5% APY staking
- 30-day minimum lock period
- Stake, unstake, claim rewards
- Reward pool management

### 3. **PersonaContract.sol**
- Creates shared Persona tokens between two users
- 50/50 split
- Unique token ID generation

### 1. **TokenEconomySequence.test.js** — Complete 65-day sequence
Covers all events from `sequence.md`:
- Day 0: Initial token distribution (Alice: 10,000, Bob: 15,000)
- Day 1: Alice stakes 5,000 CENT
- Day 2: Bob stakes 8,000 CENT
- Day 3: Create Persona token (1,000 CENT shared)
- Day 15: Mid reward snapshot
- Day 32: Alice claims rewards
- Day 35: Bob partial unstake (3,000)
- Day 40: Alice burns 500 CENT
- Day 65: Final exit with reward claims and unstake

- Token minting/burning
- Staking/unstaking
- Reward calculations
- Persona token creation
- Edge cases and security

#### 1. **CentomilaContractV2.sol**
- OpenZeppelin ERC1155 (audited base)
- Pausable extension for emergency stops
- Maximum supply cap
- Batch mint/burn operations
- Enhanced burn logic with tracking
- ReentrancyGuard protection


#### 2. **StakingContractV2.sol**
- Synthetix StakingRewards pattern
  - Reward per token calculation
  - Period-based distribution
  - Optimized reward tracking
- Aave Staking Module features
  - 7-day cooldown period
  - 10% early withdrawal penalty
- Curve Escrow pattern
  - Time-weighted staking
  - Weighted amount tracking


#### 3. **PersonaContractV2.sol**
- Lens Protocol Follow NFT pattern
  - Follow/unfollow mechanism
  - Relationship graph
- ENS Profile system
  - User profiles (name, bio, avatar)
  - Profile verification
- CyberConnect Identity module
  - Multi-platform identity verification
  - Signature-based verification


  npx hardhat run scripts/deploy-token-economy.js --network fuji


npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-network-helpers hardhat-gas-reporter solidity-coverage



### Core functionality




#### A. DID management (`/api/did`)
1. Generate DID (`POST /generate`)
   - Creates a new Ethereum wallet
   - Generates a DID in format: `did:ethr:sepolia:0x...`
   - Returns DID, address, and private key

2. Sign message (`POST /sign`)
   - Signs simple messages or feedback payloads
   - Uses Ethereum wallet signing
   - Returns signature and DID

3. Verify signature (`POST /verify`)
   - Verifies message signatures
   - Recovers signer address from signature

4. Get balance (`GET /balance/:address`)
   - Checks ETH balance for an address

#### B. Feedback system (`/api/feedback`)
1. Submit feedback (`POST /submit`)
   - Submits feedback to the smart contract
   - Requires signature verification
   - Stores on-chain with rating (1-5)

2. List feedbacks (`GET /list`)
   - Retrieves all feedback submissions from the contract

3. Get reputation (`GET /reputation/:did`)
   - Calculates reputation metrics:
     - Total rating sum
     - Feedback count
     - Average rating

---

### Smart contract (`Feedback.sol`)

Features:
- Stores feedback with submitter, receiver DIDs, message, rating, timestamp
- Tracks reputation per DID (total rating, count)
- Prevents duplicate ratings (tracks who rated whom)
- Events: `FeedbackSubmitted` for off-chain indexing

Key functions:
- `submitFeedback()` — Submit new feedback
- `getReputation()` — Get total rating and count
- `getAverageRating()` — Calculate average (returns ×100 for precision)
- `getFeedback()` — Retrieve specific feedback by index
- `getFeedbackCount()` — Total number of feedbacks

---

### Security and configuration

Environment variables:
- `INFURA_PROJECT_ID` — Infura API key for Sepolia
- `PRIVATE_KEY` — Ethereum private key for contract transactions
- `FEEDBACK_CONTRACT_ADDRESS` — Deployed contract address

Network configuration:
- Network: Sepolia testnet
- Registry: `0xdca7ef03e98e0dc2b855be647c39abe984fcf21b` (ethr-did registry)

---

### API documentation
Swagger UI at `/api-docs` with:
- Endpoint descriptions
- Request/response schemas
- Example payloads
- Error responses

---

### Deployment
- Docker: Dockerfile uses Node.js 18 Alpine
- Port: 3000
- Scripts: `npm start` (production), `npm run dev` (nodemon)

---

### Workflow example
1. Generate DID → Get `did:ethr:sepolia:0x...` and private key
2. Sign feedback → Create signature for feedback payload
3. Submit feedback → Send to smart contract with signature
4. Query reputation → Get average rating and feedback count

---

### Potential improvements
1. `index.js` is unused (just a hello world)
2. Signature verification in `submitFeedback` could be more robust
3. Error handling could be more specific
4. Add rate limiting for production
5. Consider pagination for feedback list
6. Add input validation middleware

---

### Use cases
- Decentralized reputation systems
- Peer-to-peer feedback platforms
- DID-based identity verification
- Blockchain-based review systems

This is a functional DID-based feedback system that combines decentralized identity with on-chain reputation tracking.



./deploy-to-fuji.sh

MAIN_PRIVATE_KEY="0x..." MAIN_PUBLIC_KEY="0x..." NETWORK=fuji npm start

MAIN_PRIVATE_KEY="0x..." MAIN_PUBLIC_KEY="0x..." NETWORK=fuji node test-fuji-testnet.js


