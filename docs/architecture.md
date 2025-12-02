# DID Wallet API - Architecture

## Overview

The DID Wallet API is deployed on Google Cloud Platform (GCP) in the `europe-west1` region (Belgium), with API Gateway for authentication and Cloud Run for serverless container hosting.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph Clients["🌐 Clients"]
        FE["📱 Frontend App<br/>(React/Web)"]
        BE["🖥️ Backend Services<br/>(Integrations)"]
    end

    subgraph GCP["☁️ Google Cloud Platform (europe-west1)"]
        subgraph APIGateway["🔐 API Gateway"]
            AG["API Gateway<br/>did-wallet-gateway-3vipohlg.ew.gateway.dev<br/><br/>✓ API Key Authentication<br/>✓ Rate Limiting<br/>✓ Request Routing"]
        end
        
        subgraph CloudRun["🚀 Cloud Run"]
            CR["DID Wallet API<br/>Node.js + Express<br/><br/>📚 Swagger: /api-docs<br/>🔗 DID Routes: /api/did<br/>📝 Feedback Routes: /api/feedback"]
        end
    end

    subgraph External["🌍 External Services"]
        subgraph MongoDB["🍃 MongoDB Atlas"]
            MDB[("MongoDB<br/>centomiladev.yipjigy.mongodb.net<br/><br/>📁 didwallet database<br/>👤 Users collection")]
        end
        
        subgraph Ethereum["⟠ Ethereum (Sepolia)"]
            INF["Infura RPC<br/>sepolia.infura.io<br/><br/>📜 Feedback Smart Contract<br/>0xee9751a052..."]
        end
    end

    FE -->|"x-api-key header"| AG
    BE -->|"x-api-key header"| AG
    AG -->|"Authenticated Request"| CR
    CR -->|"User Data<br/>CRUD Operations"| MDB
    CR -->|"Blockchain<br/>Transactions"| INF

    style GCP fill:#e8f5e9,stroke:#4caf50
    style APIGateway fill:#fff3e0,stroke:#ff9800
    style CloudRun fill:#e3f2fd,stroke:#2196f3
    style MongoDB fill:#e8f5e9,stroke:#4caf50
    style Ethereum fill:#fce4ec,stroke:#e91e63
    style Clients fill:#f3e5f5,stroke:#9c27b0
```

## Components

### 1. API Gateway
- **URL:** `https://did-wallet-gateway-3vipohlg.ew.gateway.dev`
- **Purpose:** Authentication, rate limiting, and request routing
- **Authentication:** API Key via `x-api-key` header

### 2. Cloud Run Service
- **Service Name:** `did-wallet-api`
- **Region:** `europe-west1` (Belgium)
- **Runtime:** Node.js 20 (Alpine)
- **Endpoints:**
  - `/api-docs` - Swagger documentation
  - `/api/did/*` - DID management endpoints
  - `/api/feedback/*` - Feedback endpoints

### 3. MongoDB Atlas
- **Cluster:** `centomiladev.yipjigy.mongodb.net`
- **Database:** `didwallet`
- **Collections:**
  - `users` - User registrations with DID and profile data

### 4. Ethereum (Sepolia Testnet)
- **Provider:** Infura RPC
- **Smart Contract:** Feedback Contract at `0xee9751a0526442b9fD30aE998F9434Ac0fB6fC5d`

## Authentication

All API requests (except `/api-docs`) require the `x-api-key` header:

```bash
curl -H "x-api-key: YOUR_API_KEY" https://did-wallet-gateway-3vipohlg.ew.gateway.dev/api/did/users
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `INFURA_PROJECT_ID` | Infura project ID for Ethereum RPC |
| `PRIVATE_KEY` | Ethereum wallet private key for signing |
| `FEEDBACK_CONTRACT_ADDRESS` | Deployed feedback smart contract address |

## Data Flow

1. **Client Request** → Frontend/Backend sends request with API key
2. **API Gateway** → Validates API key, routes to Cloud Run
3. **Cloud Run** → Processes request, interacts with MongoDB/Ethereum
4. **Response** → Returns JSON response to client

