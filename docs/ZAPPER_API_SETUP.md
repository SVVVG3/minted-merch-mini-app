# Zapper API Integration Setup

This document explains how to set up the Zapper API integration for token-gated discounts in the Minted Merch Mini App.

## 🎯 **Overview**

The Zapper API provides comprehensive blockchain portfolio data across multiple chains, enabling real-time token-gating based on:
- **NFT Holdings** - Check ownership of specific NFT collections
- **Token Balances** - Verify ERC-20 token holdings
- **Multi-chain Support** - Ethereum, Base, Polygon, Arbitrum, and more
- **Real-time Data** - Fresh portfolio information

## 🔑 **API Key Setup**

### 1. Get Your Zapper API Key

1. Visit [Zapper's Developer Portal](https://docs.zapper.xyz/)
2. Sign up for a developer account
3. Create a new API key for your project
4. Copy your API key

### 2. Environment Configuration

Add your Zapper API key to your environment variables:

```bash
# .env.local
ZAPPER_API_KEY=your_zapper_api_key_here
```

**Important Notes:**
- Without the API key, the system will use mock data for testing
- Mock data provides randomized responses for development
- Production deployments require a valid API key

## 🚀 **Token-Gating Features**

### Supported Gating Types

1. **NFT Holding** (`nft_holding`)
   - Check ownership of specific NFT collections
   - Support for multiple contract addresses
   - Multi-chain verification
   - Minimum balance requirements

2. **Token Balance** (`token_balance`)
   - Verify ERC-20 token holdings
   - Minimum balance thresholds
   - Multi-chain token support
   - Real-time balance checking

3. **Combined Gating** (`combined`)
   - Multiple requirements (NFT + Token + Whitelist)
   - Flexible AND/OR logic
   - Complex eligibility rules

### Example Discount Configurations

#### NFT-Gated Discount
```javascript
{
  code: "NOUNS20",
  gating_type: "nft_holding",
  contract_addresses: ["0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03"],
  chain_ids: [1], // Ethereum mainnet
  required_balance: 1,
  discount_value: 20,
  auto_apply: true
}
```

#### Token-Gated Discount
```javascript
{
  code: "WHALE1000",
  gating_type: "token_balance", 
  contract_addresses: ["0xA0b86a33E6417ba04e3E0F0a09ce5CF46c39748A"],
  chain_ids: [1],
  required_balance: 1000,
  discount_value: 15,
  auto_apply: true
}
```

## 🧪 **Testing & Debugging**

### Debug Endpoints

Test your token-gating setup using these endpoints:

#### 1. Test Zapper Integration
```bash
GET /api/debug/token-gated-test?action=test_zapper&fid=YOUR_FID
```

#### 2. Test User Eligibility
```bash
GET /api/debug/token-gated-test?action=test_eligibility&fid=YOUR_FID&code=NOUNS20
```

#### 3. Setup Example Discounts
```bash
GET /api/debug/token-gated-test?action=setup_examples
```

#### 4. Full Test Suite
```bash
GET /api/debug/token-gated-test?action=full_test&fid=YOUR_FID
```

### Example Test Results

**With Zapper API Key:**
```json
{
  "action": "test_zapper",
  "tests": {
    "zapper": {
      "success": true,
      "zapper_api_key_configured": true,
      "tests": {
        "nft_holdings": {
          "success": true,
          "result": {
            "hasRequiredNfts": false,
            "totalBalance": 0,
            "collectionBalances": [],
            "apiCalls": 1
          },
          "using_mock_data": false
        }
      }
    }
  }
}
```

**Without API Key (Mock Mode):**
```json
{
  "zapper_integration": {
    "api_key_configured": false,
    "status": "using mock data"
  }
}
```

## 🔧 **Implementation Details**

### Supported Chains

The integration supports these blockchain networks:

| Chain | Chain ID | Network Name |
|-------|----------|--------------|
| Ethereum | 1 | ETHEREUM |
| Base | 8453 | BASE |
| Polygon | 137 | POLYGON |
| Arbitrum | 42161 | ARBITRUM |
| Optimism | 10 | OPTIMISM |
| Avalanche | 43114 | AVALANCHE |
| Fantom | 250 | FANTOM |
| BSC | 56 | BSC |

### API Rate Limits

- **Free Tier**: 100 requests/minute
- **Pro Tier**: 1000 requests/minute
- **Enterprise**: Custom limits

### Error Handling

The system includes comprehensive fallbacks:
1. **API Failures** → Mock data responses
2. **Network Issues** → Cached results when available
3. **Invalid Contracts** → Clear error messages
4. **Rate Limiting** → Exponential backoff

## 📊 **Analytics & Monitoring**

### Eligibility Check Logging

All token-gating checks are logged to the `discount_eligibility_checks` table:

```sql
-- View recent eligibility checks
SELECT 
  checked_at,
  discount_code_id,
  fid,
  eligible,
  gating_type,
  blockchain_api_calls,
  check_duration_ms
FROM discount_eligibility_checks 
ORDER BY checked_at DESC 
LIMIT 20;
```

### Performance Metrics

- **Average Response Time**: ~200-500ms per check
- **Blockchain API Calls**: Tracked per request
- **Success Rate**: Monitored with fallback handling
- **Cache Hit Rate**: For frequently checked addresses

## 🔐 **Security Considerations**

1. **API Key Protection**
   - Store in environment variables only
   - Never commit to version control
   - Rotate keys regularly

2. **Rate Limiting**
   - Implement client-side caching
   - Batch requests when possible
   - Monitor usage quotas

3. **Data Validation**
   - Validate contract addresses
   - Sanitize user inputs
   - Check chain ID compatibility

## 🚨 **Troubleshooting**

### Common Issues

#### 1. "No wallet addresses found"
- User hasn't connected wallets in Farcaster
- FID doesn't exist in Neynar data
- **Solution**: Update wallet registration flow

#### 2. "Zapper API error: 401"
- Invalid or missing API key
- **Solution**: Check environment variables

#### 3. "Contract not found"
- Invalid contract address
- Unsupported chain
- **Solution**: Verify contract on etherscan

#### 4. Mock data in production
- API key not configured
- **Solution**: Set `ZAPPER_API_KEY` environment variable

### Debug Steps

1. **Check API Key**: Verify `ZAPPER_API_KEY` is set
2. **Test Endpoint**: Use `/api/debug/token-gated-test?action=test_zapper`
3. **Check Logs**: Monitor console for Zapper API responses
4. **Verify Contracts**: Ensure contract addresses are valid
5. **Test Wallets**: Confirm user has connected wallet addresses

## 📚 **Resources**

- [Zapper API Documentation](https://docs.zapper.xyz/)
- [GraphQL Playground](https://api.zapper.xyz/graphql)
- [Supported Networks](https://docs.zapper.xyz/docs/apis/balances#supported-networks)
- [Rate Limits](https://docs.zapper.xyz/docs/apis/rate-limits)

## 🔄 **Next Steps**

1. **Get API Key** from Zapper
2. **Configure Environment** variables
3. **Test Integration** using debug endpoints
4. **Create Token-Gated Discounts** via admin interface
5. **Monitor Performance** and adjust as needed 