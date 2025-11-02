# Staking Balance Integration

## Overview

This integration adds support for including **staked $MINTEDMERCH tokens** in users' total token holdings for token-gating eligibility checks (Merch Mogul status, leaderboard multipliers, etc.).

## Problem

When users stake their $MINTEDMERCH tokens, those tokens move from their wallets to the staking contract. Without this integration, staked tokens would not count toward:
- **Token-gated eligibility** (50M tokens for Merch Mogul status)
- **Leaderboard multipliers** (based on total holdings)
- **Token holder rankings**
- **Chat access** (token-gated chat)

## Solution

We now query users' staked balances from the Goldsky GraphQL subgraph and add them to their wallet balances for all token-gating checks.

### Architecture

```
User's Total Holdings = Wallet Balance + Staked Balance
                        ↓                  ↓
                  checkTokenBalance    getUserStakedBalance
                  (blockchain RPC)     (GraphQL subgraph)
```

## GraphQL Endpoint

**Goldsky Subgraph:** https://api.goldsky.com/api/public/project_cmhgzsg1lfhim01w4ah9rb5i5/subgraphs/betr-contracts-base/1.1/gn

## Implementation

### 1. Staking Balance API (`src/lib/stakingBalanceAPI.js`)

Two main functions:
- `getUserStakedBalance(walletAddresses)` - Returns total staked amount
- `getUserStakingDetails(walletAddresses)` - Returns detailed stake information

### 2. Token Balance Cache Integration (`src/lib/tokenBalanceCache.js`)

Modified `updateUserTokenBalance()` to:
1. Fetch wallet balance from blockchain (existing)
2. Fetch staked balance from subgraph (new)
3. Sum them for total holdings
4. Store breakdown in database

### 3. Database Schema (`database/migrations/add_staked_balance_tracking.sql`)

Added columns to `profiles` table:
- `staked_balance` - Amount in staking contract
- `wallet_balance` - Amount in wallets
- `token_balance` - Total (wallet + staked) - **used for all eligibility checks**

### 4. Admin Endpoint (`src/app/api/admin/staking-details/route.js`)

Debug endpoint: `GET /api/admin/staking-details?fid=<user_fid>`

Returns:
```json
{
  "user": { "fid": 123, "username": "alice" },
  "balances": {
    "total": 100000000,
    "wallet": 50000000,
    "staked": 50000000,
    "last_updated": "2025-11-02T09:00:00Z"
  },
  "staking": {
    "total_staked": 50000000,
    "stake_count": 2,
    "stakes": [
      {
        "wallet": "0x...",
        "amount": 30000000,
        "stakedAt": "2025-11-01T00:00:00Z",
        "active": true
      }
    ]
  }
}
```

## GraphQL Query Details

The subgraph query filters for:
- `user_in: [address1, address2, ...]` - All user's wallets
- `active: true` - Only active stakes (excludes withdrawn)

Returns:
- `user` - Wallet address that staked
- `amount` - Staked amount in wei (converted to tokens)
- `stakedAt` - Timestamp of stake
- `active` - Whether stake is still active
- `unlockTime` - When stake can be withdrawn

## Error Handling

Staking balance queries are **non-critical**:
- If the GraphQL query fails → Log warning, continue with wallet balance only
- Prevents staking service outages from blocking authentication
- Ensures backward compatibility

## Testing

Before deployment:

1. **Verify GraphQL schema matches** - The query assumes certain field names (`stakes`, `user`, `amount`, `active`). You may need to adjust based on the actual schema.

2. **Test with staked user:**
```bash
# Check if user has staked tokens showing correctly
curl "https://app.mintedmerch.shop/api/admin/staking-details?fid=<test_fid>"
```

3. **Test token gating still works:**
   - User with 30M in wallet + 20M staked = 50M total → Should get Merch Mogul status
   - User with 0 in wallet + 50M staked → Should get Merch Mogul status
   - User with 50M in wallet + 0 staked → Should get Merch Mogul status (existing behavior)

## Schema Discovery

To discover the actual GraphQL schema, query the endpoint:

```graphql
query IntrospectionQuery {
  __schema {
    types {
      name
      fields {
        name
        type {
          name
          kind
          ofType {
            name
            kind
          }
        }
      }
    }
  }
}
```

## Migration Steps

1. **Deploy code changes** (staking API + integration)
2. **Run migration** to add `staked_balance` and `wallet_balance` columns
3. **Verify with test users** using admin endpoint
4. **Monitor logs** for staking query errors
5. **If needed, adjust GraphQL query** based on actual subgraph schema

## Backward Compatibility

✅ All existing token-gating logic continues to work
✅ `token_balance` remains the single source of truth
✅ Staking query failures don't break eligibility checks
✅ Users without stakes see no change in behavior

## Future Enhancements

- Add staking APY to leaderboard display
- Show staking status in user profiles
- Create admin dashboard for staking analytics
- Add webhook for real-time stake events

