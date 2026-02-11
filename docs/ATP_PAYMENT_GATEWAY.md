# ATP Payment Gateway Specification

*Multi-token payment abstraction for Agent Trust Protocol*

**Version:** 0.1  
**Last Updated:** February 6, 2026

---

## Overview

The Payment Gateway enables users from any ecosystem to pay in their preferred token while ATP settles everything in HBAR on Hedera.

**User experience:** "Pay $15 for this rental" → Pay in ETH/SOL/USDC/BTC → Done.

**Behind the scenes:** Token converted to HBAR, rental contract funded.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      USER                                   │
│   Wallet: MetaMask / Phantom / Any                         │
│   Pays: ETH, SOL, USDC, BTC, or any supported token        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  PAYMENT GATEWAY API                        │
│                                                             │
│   POST /rental/quote                                        │
│   POST /rental/initiate                                     │
│   GET  /rental/status                                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               TOKEN CONVERSION LAYER                        │
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │  Hashport   │  │   DEX Agg   │  │  Stablecoin │       │
│   │  (Bridge)   │  │  (Swap)     │  │  (Direct)   │       │
│   └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                             │
│   Routes: ETH→wETH→HBAR, SOL→USDC→HBAR, etc.              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    HEDERA LAYER                             │
│                                                             │
│   • HBAR received                                           │
│   • Rental contract funded                                  │
│   • Rental initiated                                        │
│   • HCS logged                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Supported Tokens

### Tier 1: Native Support

Direct bridges/swaps available:

| Token | Network | Conversion Path |
|-------|---------|-----------------|
| HBAR | Hedera | Native |
| USDC | Hedera | Direct |
| USDC | Ethereum | Hashport → Hedera USDC → HBAR |
| USDT | Ethereum | Hashport → HBAR |
| ETH | Ethereum | Hashport → wETH on Hedera → HBAR |
| WBTC | Ethereum | Hashport → wBTC → HBAR |

### Tier 2: DEX Routing

Swap to Tier 1 token first:

| Token | Path |
|-------|------|
| SOL | SOL → USDC (Jupiter) → Wormhole → Hedera USDC → HBAR |
| MATIC | MATIC → USDC (Uniswap) → Hashport → HBAR |
| ARB | ARB → ETH (Uniswap) → Hashport → HBAR |

### Tier 3: Fiat

On-ramp partners:

| Method | Partner | Flow |
|--------|---------|------|
| Card | Moonpay | USD → HBAR direct |
| Bank | Banxa | USD → USDC → HBAR |
| Apple Pay | Transak | USD → HBAR |

---

## API Specification

### Get Quote

```
POST /rental/quote
```

**Request:**
```json
{
  "agent_id": "0.0.123456",
  "duration_sec": 3600,
  "pay_token": "ETH",
  "pay_network": "ethereum"
}
```

**Response:**
```json
{
  "quote_id": "q_abc123",
  "expires_at": "2026-02-06T00:20:00Z",
  "rental": {
    "agent_id": "0.0.123456",
    "duration_sec": 3600,
    "price_usd": 15.00,
    "stake_usd": 55.00,
    "total_usd": 70.00
  },
  "payment": {
    "token": "ETH",
    "network": "ethereum",
    "amount": "0.0245",
    "amount_wei": "24500000000000000",
    "rate": "2857.14",
    "rate_source": "coingecko",
    "slippage_tolerance": "1.0%"
  },
  "conversion": {
    "path": ["ETH", "wETH (Hedera)", "HBAR"],
    "estimated_hbar": 7778,
    "fees": {
      "bridge": "0.1%",
      "swap": "0.3%",
      "total_usd": 0.28
    }
  },
  "deposit_address": "0x...",
  "deposit_memo": "ATP:q_abc123"
}
```

### Initiate Rental

```
POST /rental/initiate
```

**Request:**
```json
{
  "quote_id": "q_abc123",
  "tx_hash": "0x...",
  "renter_hedera_account": "0.0.789012"
}
```

**Response:**
```json
{
  "status": "processing",
  "rental_id": "r_def456",
  "steps": [
    { "step": "payment_received", "status": "complete", "tx": "0x..." },
    { "step": "bridge_initiated", "status": "pending" },
    { "step": "hbar_received", "status": "waiting" },
    { "step": "rental_funded", "status": "waiting" },
    { "step": "rental_active", "status": "waiting" }
  ],
  "estimated_completion": "2026-02-06T00:22:00Z"
}
```

### Check Status

```
GET /rental/status/{rental_id}
```

**Response:**
```json
{
  "rental_id": "r_def456",
  "status": "active",
  "steps": [
    { "step": "payment_received", "status": "complete", "tx": "0x...", "at": "..." },
    { "step": "bridge_initiated", "status": "complete", "tx": "...", "at": "..." },
    { "step": "hbar_received", "status": "complete", "amount": 7750, "at": "..." },
    { "step": "rental_funded", "status": "complete", "tx": "0.0.999@...", "at": "..." },
    { "step": "rental_active", "status": "complete", "at": "..." }
  ],
  "rental_contract": "0.0.888888",
  "hcs_topic": "0.0.10261370"
}
```

---

## Conversion Implementation

### Hashport Bridge (ETH/ERC-20 → Hedera)

```javascript
async function bridgeViaHashport(token, amount, destinationAccount) {
    // 1. User deposits to Hashport vault on Ethereum
    const depositTx = await hashportVault.deposit(token, amount, {
        destinationChain: 'hedera',
        destinationAccount: destinationAccount
    });
    
    // 2. Wait for bridge confirmation (typically 10-15 min)
    const bridgeResult = await hashportBridge.waitForCompletion(depositTx.hash);
    
    // 3. Wrapped token arrives on Hedera
    return bridgeResult.hederaTokenId;
}
```

### SaucerSwap (Any Hedera Token → HBAR)

```javascript
async function swapToHbar(tokenId, amount) {
    // Get best route
    const route = await saucerswap.getRoute(tokenId, 'HBAR', amount);
    
    // Execute swap
    const swapTx = await saucerswap.swap({
        tokenIn: tokenId,
        tokenOut: 'HBAR',
        amountIn: amount,
        minAmountOut: route.minOutput,
        deadline: Date.now() + 300000 // 5 min
    });
    
    return swapTx.amountOut;
}
```

### Full Conversion Flow

```javascript
async function convertToHbar(sourceToken, sourceNetwork, amount, destination) {
    let hederaToken, hbarAmount;
    
    // Step 1: Bridge to Hedera if on external network
    if (sourceNetwork !== 'hedera') {
        hederaToken = await bridgeViaHashport(sourceToken, amount, destination);
    } else {
        hederaToken = sourceToken;
    }
    
    // Step 2: Swap to HBAR if not already HBAR
    if (hederaToken !== 'HBAR') {
        hbarAmount = await swapToHbar(hederaToken, amount);
    } else {
        hbarAmount = amount;
    }
    
    return hbarAmount;
}
```

---

## Price Oracle

### Sources

| Source | Use | Update Frequency |
|--------|-----|------------------|
| CoinGecko | Primary | Real-time |
| Chainlink | Fallback | On-chain |
| SaucerSwap | Hedera DEX price | Real-time |

### Price Fetch

```javascript
async function getPrice(token, quote = 'USD') {
    const sources = [
        () => coingecko.getPrice(token, quote),
        () => chainlink.getPrice(token, quote),
        () => saucerswap.getPrice(token, quote)
    ];
    
    // Use median of available sources
    const prices = await Promise.allSettled(sources.map(s => s()));
    const validPrices = prices
        .filter(p => p.status === 'fulfilled')
        .map(p => p.value);
    
    return median(validPrices);
}
```

### Quote Validity

- Quotes valid for 5 minutes
- User must complete payment within window
- If price moves >2%, quote invalidated
- User can request new quote

---

## Fee Structure

| Component | Fee | Paid By |
|-----------|-----|---------|
| Bridge (Hashport) | 0.1% | User |
| Swap (SaucerSwap) | 0.3% | User |
| Gateway service | 0.5% | User |
| Hedera tx fees | ~$0.001 | Included |

**Total overhead:** ~1% of payment amount

**Example:** $70 payment
- Fees: ~$0.70
- Net to rental: ~$69.30 in HBAR

---

## Refund Handling

If rental doesn't initiate (bridge fails, etc.):

1. Detect failure within timeout
2. Reverse bridge if possible
3. Refund to source address in source token
4. Minus bridge fees (non-recoverable)

```javascript
async function handleRefund(quoteId, reason) {
    const quote = await getQuote(quoteId);
    
    // Check refund eligibility
    if (quote.status === 'rental_active') {
        throw new Error('Cannot refund active rental');
    }
    
    // Determine refund amount (minus non-recoverable fees)
    const refundAmount = quote.payment.amount - quote.conversion.fees.nonRecoverable;
    
    // Execute refund via reverse bridge
    await bridgeBack(quote.payment.network, quote.depositor, refundAmount);
    
    // Log refund
    await logRefund(quoteId, reason, refundAmount);
}
```

---

## Security Considerations

### Deposit Address Security

- Unique deposit address per quote
- Monitored for exact amount
- Timeout if not funded (15 min)
- Excess funds refunded

### Price Manipulation

- Multiple oracle sources
- TWAP for large amounts
- Maximum slippage tolerance
- Quote expiry prevents stale prices

### Bridge Security

- Hashport is audited, battle-tested
- Multi-sig validators
- Insurance fund for failures

---

## Integration Partners

| Partner | Service | Status |
|---------|---------|--------|
| Hashport | ETH/ERC-20 bridge | Available |
| SaucerSwap | Hedera DEX | Available |
| Moonpay | Fiat on-ramp | Integration needed |
| Wormhole | SOL bridge | Integration needed |

---

## Instant Activation (Liquidity Pool)

### The Problem

Bridge delays (10-15 min) create poor UX for cross-chain users.

### The Solution

Pre-funded liquidity pool enables instant activation:

```
┌─────────────────────────────────────────────────────────────┐
│                  LIQUIDITY POOL                             │
│                                                             │
│   HBAR Reserve: 100,000 HBAR                               │
│   Funded by: Gateway operator                               │
│   Earns: 0.5% spread on conversions                        │
│                                                             │
│   User pays ETH → Pool releases HBAR instantly             │
│   Pool rebalances via bridge (async, user doesn't wait)    │
└─────────────────────────────────────────────────────────────┘
```

### Flow with Liquidity Pool

```
1. User pays in ETH
2. Gateway checks: is liquidity pool funded?
3. YES: 
   - Release HBAR from pool instantly
   - Fund rental contract
   - Rental active in <1 minute
   - Pool rebalances via bridge (async)
4. NO (pool depleted):
   - Fall back to bridge flow
   - Show progress UI
   - Rental active in 10-15 minutes
```

### Pool Economics

| Parameter | Value |
|-----------|-------|
| Minimum pool size | 50,000 HBAR |
| Target pool size | 100,000 HBAR |
| Operator spread | 0.5% |
| Rebalance threshold | 25% depleted |
| Dynamic fee (low pool) | +0.25% when <50% |

**Risk mitigation:**
- Dynamic fees increase when pool low (discourages draining)
- Auto-rebalance triggers at threshold
- Operator monitors and tops up as needed

---

## User Flow Example

**Ethereum user wants to rent agent for 1 hour:**

**With liquidity pool (typical):**
1. User clicks "Rent for $15"
2. Gateway shows: "Pay 0.0052 ETH"
3. User connects MetaMask, confirms tx
4. ETH detected, pool has HBAR
5. HBAR released from pool instantly
6. Rental contract funded
7. Rental active! (~45 seconds total)
8. Pool rebalances via bridge (async)

**Without pool (fallback):**
1. User clicks "Rent for $15"
2. Gateway shows: "Pay 0.0052 ETH (10-15 min activation)"
3. Option shown: "Pay in HBAR for instant activation"
4. If user proceeds with ETH: progress UI during bridge
5. Rental active after bridge completes

**For Hedera-native users:** Always instant (<10 seconds)

---

*This completes the ATP specification suite.*
