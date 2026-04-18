# ATP Payment Architecture

## Overview

All rentals settle in HBAR on the ATPEscrow smart contract. Payment abstraction handles the conversion from any source to HBAR.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Renter's Perspective                          │
│                                                                 │
│  "Aite, pay for the rental with ETH"                           │
│        │                                                        │
│        ▼                                                        │
│  ┌──────────────────────────────────────────────┐              │
│  │         ATP Payment Router                    │              │
│  │                                               │              │
│  │  HBAR ──→ Direct deposit to escrow            │              │
│  │  ETH  ──→ Hashport Bridge ──→ HBAR ──→ escrow│              │
│  │  SOL  ──→ Hashport Bridge ──→ HBAR ──→ escrow│              │
│  │  USDC ──→ Hashport Bridge ──→ HBAR ──→ escrow│              │
│  │  Fiat ──→ MoonPay/Transak ──→ HBAR ──→ escrow│              │
│  └──────────────────────────────────────────────┘              │
│        │                                                        │
│        ▼                                                        │
│  ┌──────────────────────────────────────────────┐              │
│  │      ATPEscrow.sol (Hedera EVM)              │              │
│  │                                               │              │
│  │  deposit() → lock → settle() → distribute    │              │
│  │                                               │              │
│  │  All on-chain. All auditable. All on Hedera.  │              │
│  └──────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Payment Methods

### Tier 1: Native (Available at Launch)

#### HBAR Direct
- Renter sends HBAR directly to the escrow contract
- Zero conversion, zero fees beyond gas
- Best for Hedera-native users
- UX: Renter sends HBAR to contract address with rental ID in memo

### Tier 2: Cross-Chain (Phase 2)

#### ETH / ERC-20 Tokens
- **Method:** Hashport Bridge (official Hedera bridge)
- **Flow:** Renter deposits ETH on Ethereum → Hashport mints wrapped ETH on Hedera → Swap to HBAR on SaucerSwap → Deposit to escrow
- **Alternative:** Use a DEX aggregator API to handle the swap
- **Fees:** Bridge fee (~0.1%) + swap fee (~0.3%) + gas
- **Latency:** ~5-15 minutes (Ethereum finality + bridge)

#### SOL
- **Method:** Hashport Bridge or Wormhole
- **Flow:** Similar to ETH — bridge to Hedera, swap to HBAR, deposit
- **Fees:** Similar to ETH path
- **Latency:** ~2-5 minutes (Solana is faster)

#### USDC/USDT (Stablecoins)
- **Method:** Direct via Hashport (USDC is natively available on Hedera via HTS)
- **Flow:** If already on Hedera, swap to HBAR on SaucerSwap. If on Ethereum/Solana, bridge first.
- **Best for:** Renters who want price stability (no HBAR volatility risk)

### Tier 3: Fiat (Phase 3)

#### Credit Card / Bank Transfer
- **Method:** MoonPay, Transak, or Banxa (fiat-to-HBAR on-ramps)
- **Flow:** Renter pays USD → On-ramp purchases HBAR → Sends to escrow
- **Fees:** 1-5% (on-ramp markup)
- **Latency:** Instant to ~30 min depending on payment method
- **KYC:** Required by on-ramp provider (not by ATP)

## Pricing Model

### Cost Calculation
- Owner sets price per interaction or per minute (in USD equivalent)
- Exchange rate locked at deposit time (prevents volatility risk)
- Budget cap = max the renter will pay
- Deposit = budget cap (full prepay, refund unused)

### Example Pricing
```
Model: Opus 4.6
Owner cost: ~$15/1M input tokens, ~$75/1M output tokens
Owner markup: 50% (covers infrastructure + profit)
Renter price: ~$0.05-0.50 per interaction (depending on complexity)

10 HBAR budget cap ≈ $0.50-1.50 (at current rates)
Covers: 20-50 typical interactions
```

### Exchange Rate
- Fetched from CoinGecko + Binance (volume-weighted average)
- Locked at deposit time in the contract event
- Displayed to renter before deposit: "10 HBAR ≈ $X.XX"

## Renter UX (In Telegram)

### Flow 1: HBAR Direct
```
Renter: "I want to rent Aite"
Bot:    "Welcome! Aite is available for rent.
         Your rental is metered against the budget you deposit, with a small activation floor.

         Send 10 HBAR to: 0.0.XXXXX
         Memo: rental-abc123

         I'll start your session once the deposit confirms (~3 sec)."

[Renter sends HBAR via HashPack/wallet]

Bot:    "✅ Deposit confirmed! Your rental session with Aite is now active.
         Budget: 10 HBAR | Billing: metered with activation floor
         HCS audit: hashscan.io/mainnet/topic/0.0.10272696

         Say 'end session' when you're done. Unused HBAR will be refunded."
```

### Flow 2: ETH (Future)
```
Renter: "Pay with ETH"
Bot:    "No problem. I'll need ~0.0005 ETH ($1.50 equivalent).

         Send to this Ethereum address: 0xABC...

         It'll take ~10 minutes to bridge to Hedera and start your session.
         I'll notify you when it's ready."
```

### Flow 3: Credit Card (Future)
```
Renter: "Pay by credit card"
Bot:    "Here's your payment link: [MoonPay/Transak URL]
         Amount: $1.50 (will be converted to HBAR)

         Complete the payment and I'll start your session automatically."
```

## Contract Deployment Plan

1. **Testnet first** — Deploy to Hedera testnet, run full lifecycle test
2. **Audit** — Review contract logic (small enough for manual review)
3. **Mainnet** — Deploy with conservative limits (low minDeposit, low maxDuration)
4. **Register owners** — Add Gregg's operator account as first registered owner

### Deployment Parameters
- Protocol fee: 200 bps (2%)
- Min deposit: 1 HBAR (100,000,000 tinybars)
- Fee recipient: Treasury (0.0.8332371) or operator (0.0.10255397)
- Admin: Operator account (0.0.10255397)

## Security Considerations

- **Reentrancy:** Settlement uses checks-effects-interactions pattern. Consider adding ReentrancyGuard.
- **Price oracle:** Exchange rate is NOT on-chain (too expensive). Locked at deposit time via event.
- **Dispute resolution:** Currently admin-only. Future: multi-sig or DAO governance.
- **Emergency withdrawal:** Admin can extract stuck funds. Should be timelock-guarded in production.
- **Budget cap enforcement:** Contract enforces. Sidecar ALSO enforces (belt + suspenders).
