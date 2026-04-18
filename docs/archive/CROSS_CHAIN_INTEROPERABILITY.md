# Cross-Chain Interoperability Guide

**Purpose:** Document paths and costs to move/convert assets across chains without CEX (no KYC required).

**Last Updated:** 2026-02-08

---

## Overview

AI agents cannot open CEX accounts (KYC requirements). All cross-chain operations must use:
- **Bridges** — Move assets between chains
- **DEXs** — Swap assets within a chain
- **Aggregators** — Find best routes across multiple bridges/DEXs

---

## 1. DEXs by Network

### Hedera
| DEX | Type | API | Notes |
|-----|------|-----|-------|
| **SaucerSwap** | AMM | Requires auth | Largest on Hedera, V2 uses concentrated liquidity |
| **HeliSwap** | AMM | Public | Good HBAR pairs |
| **Pangolin** | AMM | Public | Cross-chain via Axelar |

**Programmatic Access:**
```javascript
// SaucerSwap uses Hedera smart contracts
// Router: 0.0.3045981
// Requires ContractExecuteTransaction via Hedera SDK
```

### Solana
| DEX | Type | API | Notes |
|-----|------|-----|-------|
| **Jupiter** | Aggregator | ✅ Free API | Best rates, aggregates all Solana DEXs |
| **Raydium** | AMM | Public | Large liquidity |
| **Orca** | AMM | SDK | Whirlpools (concentrated liquidity) |

**Jupiter API (Recommended):**
```bash
# Get quote
curl "https://quote-api.jup.ag/v6/quote?inputMint=SOL&outputMint=USDC&amount=1000000000"

# Execute swap (POST with quote + wallet pubkey)
POST https://quote-api.jup.ag/v6/swap-instructions
```

### Ethereum
| DEX | Type | API | Notes |
|-----|------|-----|-------|
| **Uniswap** | AMM | SDK/Contracts | V3 concentrated liquidity |
| **1inch** | Aggregator | API (key req) | Best rates |
| **Curve** | StableSwap | Contracts | Best for stablecoins |
| **Balancer** | Weighted Pools | SDK | Multi-asset pools |

**Uniswap V3 Programmatic:**
```javascript
const { ethers } = require('ethers');
// SwapRouter02: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
// Use exactInputSingle() for simple swaps
```

### Base
| DEX | Type | API | Notes |
|-----|------|-----|-------|
| **Aerodrome** | ve(3,3) | Contracts | Largest on Base |
| **Uniswap** | AMM | SDK | V3 deployed |
| **BaseSwap** | AMM | Contracts | Native Base DEX |

### Arbitrum
| DEX | Type | API | Notes |
|-----|------|-----|-------|
| **Camelot** | AMM | Contracts | Native Arb DEX |
| **Uniswap** | AMM | SDK | High liquidity |
| **GMX** | Perps | Contracts | Leveraged trading |

### Avalanche
| DEX | Type | API | Notes |
|-----|------|-----|-------|
| **Trader Joe** | AMM | SDK | Largest on AVAX |
| **Pangolin** | AMM | Contracts | PNG token |

### BSC
| DEX | Type | API | Notes |
|-----|------|-----|-------|
| **PancakeSwap** | AMM | SDK | Largest on BSC |

### Polygon
| DEX | Type | API | Notes |
|-----|------|-----|-------|
| **QuickSwap** | AMM | Contracts | V3 available |
| **Uniswap** | AMM | SDK | High liquidity |

---

## 2. Cross-Chain Bridges

### Native/Specialized Bridges

| Bridge | Chains | Min Amount | Fees | API | Best For |
|--------|--------|------------|------|-----|----------|
| **Hashport** | Hedera ↔ 11 EVM | ~$50 USD | 0.5% | ✅ REST | HBAR to EVM |
| **Wormhole** | SOL, ETH, BSC, AVAX, + | Low | ~$1-5 | SDK | Solana bridges |
| **Axelar** | 60+ incl Hedera, Cosmos | Varies | ~$1-10 | SDK | Multi-chain |
| **LayerZero** | 50+ chains | Low | Gas only | Contracts | OFT tokens |

### Aggregators (Best for Finding Routes)

| Aggregator | Chains | API | Notes |
|------------|--------|-----|-------|
| **Symbiosis** | 45+ incl BTC, SOL, TRON | ✅ | No KYC, single tx |
| **Rango** | 50+ | ✅ | Meta-aggregator |
| **Rubic** | 70+ | ✅ | Cross-chain + DEX |
| **LI.FI** | 30+ | ✅ SDK | Bridge aggregator |
| **Socket** | 15+ | ✅ | Powers Bungee |

### Native Asset Bridges (BTC, non-EVM)

| Bridge | Assets | Notes |
|--------|--------|-------|
| **Thorchain** | BTC, ETH, BNB, AVAX, DOGE, LTC | Native swaps, no wrapped tokens |
| **Maya Protocol** | BTC, ETH, RUNE | Thorchain fork |
| **Allbridge** | SOL ↔ EVM | Good for Solana |
| **Portal (Wormhole)** | SOL ↔ EVM | Official Wormhole UI |

---

## 3. Programmatic Execution

### Pattern 1: Single-Chain Swap
```javascript
// Example: Swap on Solana via Jupiter
const quote = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${SOL}&outputMint=${USDC}&amount=${amount}`);
const swap = await fetch('https://quote-api.jup.ag/v6/swap', {
  method: 'POST',
  body: JSON.stringify({ quoteResponse: quote, userPublicKey: wallet.publicKey })
});
// Sign and send transaction
```

### Pattern 2: Bridge (Hashport Example)
```javascript
// 1. Query bridge steps
const steps = await fetch(`https://mainnet.api.hashport.network/api/v1/bridge?sourceNetworkId=295&targetNetworkId=8453&amount=${amount}&recipient=${evmAddress}`);

// 2. Execute Hedera transfer with memo
const tx = new TransferTransaction()
  .addHbarTransfer(sender, Hbar.from(-amount))
  .addHbarTransfer(bridgeAccount, Hbar.from(amount))
  .setTransactionMemo(`${targetChainId}-${recipient}`);

// 3. Poll for signatures
// 4. Claim on destination chain
```

### Pattern 3: Cross-Chain Swap (Symbiosis)
```javascript
// Symbiosis API - single call handles everything
const quote = await fetch('https://api.symbiosis.finance/crosschain/v1/swap', {
  method: 'POST',
  body: JSON.stringify({
    tokenAmountIn: { address: tokenIn, chainId: chainIn, amount },
    tokenOut: { address: tokenOut, chainId: chainOut },
    from: senderAddress,
    to: recipientAddress,
    slippage: 100 // 1%
  })
});
// Returns transaction to sign
```

---

## 4. Cost Analysis

### Bridge Fees
| Route | Fee | Gas Cost | Total Est. |
|-------|-----|----------|------------|
| Hedera → Base (Hashport) | 0.5% | ~$0.01 Hedera + ~$0.10 Base | 0.5% + $0.11 |
| Hedera → ETH (Hashport) | 0.5% | ~$0.01 Hedera + ~$5-20 ETH | 0.5% + $5-20 |
| SOL → ETH (Wormhole) | ~0.1% | ~$0.001 SOL + ~$5-20 ETH | ~$5-20 |
| Any → Any (Symbiosis) | ~0.3-1% | Varies | 0.3-1% + gas |

### DEX Fees (Typical)
| DEX Type | Swap Fee |
|----------|----------|
| Uniswap V3 | 0.05-1% (pool dependent) |
| Curve | 0.04% |
| Jupiter | 0% (just gas) |
| SaucerSwap | 0.25-0.3% |

### Gas Costs by Chain
| Chain | Simple Transfer | DEX Swap |
|-------|----------------|----------|
| Hedera | $0.001 | $0.01-0.05 |
| Solana | $0.0001-0.001 | $0.001-0.01 |
| Base | $0.01-0.05 | $0.05-0.50 |
| Arbitrum | $0.01-0.10 | $0.10-0.50 |
| Polygon | $0.001-0.01 | $0.01-0.10 |
| Ethereum | $1-10 | $5-50 |
| Avalanche | $0.01-0.10 | $0.10-1.00 |
| BSC | $0.05-0.20 | $0.20-1.00 |

---

## 5. Recommended Routes by Scenario

### HBAR → Other Assets
1. **HBAR → EVM tokens:** Hashport to Base/Polygon (low gas) → swap on DEX
2. **HBAR → SOL:** Hashport to ETH → Wormhole to SOL, OR use Symbiosis
3. **HBAR → BTC:** Not direct; use Thorchain (HBAR→ETH→BTC via wrapped)

### Acquiring Native Tokens (No CEX)
| Target | Best Route | Est. Cost |
|--------|------------|-----------|
| ETH | Bridge HBAR → sell for ETH on Uniswap | 0.5% + $5-20 gas |
| SOL | Symbiosis or Wormhole from EVM | ~1% + $1-5 |
| BTC | Thorchain from ETH/AVAX | ~0.3% + gas |
| DOT | Limited - Acala bridge from ETH | Complex |
| ADA | Very limited - mostly CEX only | N/A |
| XRP | Very limited - mostly CEX only | N/A |

### Non-EVM Challenges
- **XRP, ADA, DOT:** Limited bridge options, mostly require CEX
- **BTC:** Thorchain is best DEX option
- **DOGE:** Thorchain supports it

---

## 6. Our Current Capabilities

### Implemented ✅
- Hedera SDK transactions (transfers, HCS)
- Hashport bridge (Hedera → EVM)
- Base wallet operations (ethers.js)
- Balance checking across chains

### Needs Implementation 🔧
- Jupiter API integration (Solana swaps)
- Symbiosis API integration (cross-chain)
- Thorchain API (native BTC/DOGE)
- SaucerSwap contract calls (Hedera DEX)
- Uniswap/Aerodrome swaps (EVM DEXs)

### Blocked ❌
- XRP (no good bridge)
- ADA (no good bridge)
- DOT (complex, limited)

---

## 7. Implementation Priority

1. **Jupiter (Solana)** — Free API, simple integration
2. **Symbiosis** — Single API for cross-chain
3. **SaucerSwap** — Hedera native swaps
4. **Uniswap/Aerodrome** — EVM swaps
5. **Thorchain** — Native BTC access

---

## 8. Wallet Requirements

Each chain needs:
1. **Private key** in Keychain
2. **Native token** for gas (SOL, ETH, etc.)
3. **RPC endpoint** (public or dedicated)

### Current Exodus Wallets
| Chain | Address | Has Gas? |
|-------|---------|----------|
| Hedera | 0.0.10268595 | ✅ 10 HBAR |
| EVM (all) | 0x8A94...477F | ✅ 0.047 ETH (Base) |
| Solana | 8kdg...fT2g | ❌ Need SOL |
| Bitcoin | bc1q...2mu9 | ❌ Need BTC |
| XRP | rne6...FfdE | ❌ Need XRP |
| Polkadot | 14ec...JQ6o | ❌ Need DOT |
| Cardano | addr1...tcg7 | ❌ Need ADA |
| Dogecoin | DAbu...kyz | ❌ Need DOGE |
| Tron | TY5M...fdj | ❌ Need TRX |

---

*This document will be updated as we implement and test each path.*
