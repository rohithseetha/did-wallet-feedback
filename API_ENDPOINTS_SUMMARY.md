# API Endpoints Summary

## Version 2.0.0

### Total Endpoints: 50+ (27 new endpoints added)

---

## 🔴 Critical Endpoints

### Token
- `POST /api/token/approve-all` - **CRITICAL**: Required for staking
  - Approves operator (e.g., staking contract) to transfer tokens
  - **Must be called before staking**

---

## 📝 Token Endpoints (13 total)

### Read Operations
- `GET /api/token/balance/:address` - Get token balance
- `GET /api/token/info` - Get token contract info (enhanced)
- `GET /api/token/has-role/:role/:address` - Check role

### Write Operations
- `POST /api/token/mint` - Mint tokens (requires MINTER_ROLE)
- `POST /api/token/batch-mint` - Batch mint (requires MINTER_ROLE)
- `POST /api/token/transfer` - Transfer tokens
- `POST /api/token/approve-all` - **CRITICAL**: Approve operator
- `POST /api/token/burn` - Burn tokens
- `POST /api/token/batch-burn` - Batch burn
- `POST /api/token/set-max-supply` - Set max supply (requires ADMIN_ROLE)
- `POST /api/token/pause` - Pause contract (requires PAUSER_ROLE)
- `POST /api/token/unpause` - Unpause contract (requires PAUSER_ROLE)
- `POST /api/token/grant-role` - Grant role (requires ADMIN_ROLE)
- `POST /api/token/revoke-role` - Revoke role (requires ADMIN_ROLE)

---

## 💰 Staking Endpoints (11 total)

### Read Operations
- `GET /api/staking/info/:address?` - Get staking info
- `GET /api/staking/contract-info` - Get contract info (enhanced)
- `GET /api/staking/has-role/:role/:address` - Check role

### Write Operations
- `POST /api/staking/stake` - Stake tokens
- `POST /api/staking/cooldown` - Start cooldown period
- `POST /api/staking/unstake` - Unstake tokens
- `POST /api/staking/claim` - Claim rewards
- `POST /api/staking/notify-reward` - Notify reward (requires REWARDS_DISTRIBUTOR_ROLE)
- `POST /api/staking/set-reward-duration` - Set duration (requires OPERATOR_ROLE)
- `POST /api/staking/grant-role` - Grant role (requires ADMIN_ROLE)
- `POST /api/staking/revoke-role` - Revoke role (requires ADMIN_ROLE)

---

## 👤 Persona Endpoints (18 total)

### Read Operations
- `GET /api/persona/profile/:address?` - Get profile
- `GET /api/persona/following/:address?` - Get following list
- `GET /api/persona/followers/:address?` - Get followers list
- `GET /api/persona/relationships/:address?` - Get relationships
- `GET /api/persona/user-relationships/:address?` - Get relationship IDs
- `GET /api/persona/relationship/:tokenId` - Get relationship by token ID
- `GET /api/persona/is-following/:follower/:following` - Check follow status
- `GET /api/persona/identity-verified/:address/:platform` - Check verification
- `GET /api/persona/has-role/:role/:address` - Check role

### Write Operations
- `POST /api/persona/profile` - Create/update profile
- `POST /api/persona/follow` - Follow user
- `POST /api/persona/unfollow` - Unfollow user
- `POST /api/persona/verify-identity` - Verify identity (requires VERIFIER_ROLE)
- `POST /api/persona/relationship` - Create relationship (requires OPERATOR_ROLE)
- `POST /api/persona/update-reputation` - Update reputation (requires OPERATOR_ROLE)
- `POST /api/persona/grant-role` - Grant role (requires ADMIN_ROLE)
- `POST /api/persona/revoke-role` - Revoke role (requires ADMIN_ROLE)

---

## 📚 Documentation

- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI Spec**: `src/swagger.yaml`

---

## 🔐 Role Requirements

### Token Contract
- `MINTER_ROLE` - Can mint tokens
- `BURNER_ROLE` - Can burn tokens
- `PAUSER_ROLE` - Can pause/unpause
- `DEFAULT_ADMIN_ROLE` - Can grant/revoke roles

### Staking Contract
- `OPERATOR_ROLE` - Can configure staking
- `REWARDS_DISTRIBUTOR_ROLE` - Can notify rewards
- `DEFAULT_ADMIN_ROLE` - Can grant/revoke roles

### Persona Contract
- `OPERATOR_ROLE` - Can manage relationships
- `VERIFIER_ROLE` - Can verify identities
- `DEFAULT_ADMIN_ROLE` - Can grant/revoke roles

---

## 🧪 Testing

Run the test suite:
```bash
node scripts/test-new-endpoints.js
```

**Note**: Some endpoints require:
- Funded wallet (for transactions)
- Specific roles (for admin operations)
- Existing tokens (for burn/transfer operations)

