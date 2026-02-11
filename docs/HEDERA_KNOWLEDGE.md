# Hedera Knowledge Base

*Last updated: February 1, 2026*

## Overview

Hedera is a public distributed ledger technology (DLT) network that uses the **hashgraph consensus algorithm** rather than traditional blockchain. It positions itself as the "trust layer of the digital economy" for regulated industries.

## Key Differentiators

### Technology
- **Hashgraph consensus**: Not blockchain. Uses gossip protocol + virtual voting
- **Asynchronous Byzantine Fault Tolerant (aBFT)**: Strongest form of BFT security
- **Finality in <3 seconds**: Transactions cannot be reversed once finalized
- **100% efficient**: No wasted computation (unlike PoW mining)
- **EVM compatible**: Supports Solidity smart contracts, works with Ethereum tools
- **Carbon negative**: Uses less energy than a Visa transaction

### Economics
- **Fixed USD fees**: Starting at $0.0001 per transaction
- **Predictable pricing**: Fees denominated in USD, not volatile crypto

### Governance
- **Hedera Council**: Rotating group of leading enterprises, institutions, nonprofits, and universities
- **Permissioned node operators**: Council members run network nodes
- **OFAC compliant**: Built in regulatory compliance at protocol level

## Core Services

### Hedera Consensus Service (HCS)
- Create topics, submit messages, achieve consensus on order
- Used for audit trails, supply chain, timestamping
- Enables "trust timestamps" with legal weight

### Token Service
- Native tokenization (fungible + NFTs)
- ERC compatible tokens
- Lower cost than Ethereum L1

### Smart Contracts
- Solidity support
- HIP 1249: Enhanced throttling for more throughput (Jan 2026)
- Protocol level automation coming

## Native Currency: HBAR
- Used for transaction fees and network staking
- Symbol: ℏ (Unicode character)

## Ecosystem (Recent News Jan 2026)

### New Council Partners (Jan 23, 2026)
- **Halborn**: Security firm, Strategic Partner
- **HashPack**: Leading wallet, Community Partner
- **Hashgraph Online (HOL)**: Developer tools + HCS standards
- **Genfinity**: Media/content/podcasts

### McLaren Racing Partnership (Jan 22, 2026)
- Multi year partnership for digital fan engagement
- Hedera becomes Official Partner

### Davos 2026 (Jan 26, 2026)
- Hedera at World Economic Forum
- Themes: tokenization, AI + blockchain convergence, digital trust
- Sponsored USA House
- Key topics: stablecoins, market structure bill, AI accountability

### DevDay Denver (Feb 17, 2026)
- Alongside ETHDenver
- Deep technical sessions

## Key People & Accounts to Follow

- **@hedera**: Official account
- **@jaycoolh**: Builder, creates content about building onchain
- **@hashaboratory**: Community
- **@hashpackapp**: Wallet
- **@hashgraphonline**: Developer tools, HCS standards
- **@GenfinityIO**: Media/podcasts

## Why Hedera for AI

From their messaging: "Hedera gives AI systems the trust layer they need with real time finality, low cost verifiability, and tamper proof data for autonomous agents and intelligent applications."

Use cases:
- Data provenance for AI training
- Model accountability
- Autonomous agent transactions
- Verifiable AI outputs

## Technical Details

### Hashgraph vs Blockchain
| Aspect | Hashgraph | Traditional Blockchain |
|--------|-----------|----------------------|
| Consensus | Virtual voting via gossip | PoW/PoS with block creation |
| Finality | Absolute, <3 sec | Probabilistic, minutes |
| Efficiency | 100% | Wastes work on orphan blocks |
| Throughput | Bandwidth limited only | Block size limited |
| Fair ordering | Consensus timestamps | Miner controlled |

### Gossip Protocol
1. Node A tells Node B everything it knows
2. Node B tells Node C everything (including what A said)
3. Information spreads exponentially
4. Virtual voting determines consensus without extra messages

### Byzantine Fault Tolerance
- Tolerates up to 1/3 malicious nodes
- Works even if attackers control network timing
- ACID compliant as distributed database

## Content Angles for X

### Hot Takes
- "Blockchain is last decade. Hashgraph is what comes next."
- "Why would enterprises build on chains that can be front run?"
- "AI needs trust rails. That's Hedera."
- "3 second finality or get out of my face"

### Engagement Topics
- Tokenization (hot in TradFi)
- AI + DLT convergence
- Enterprise adoption vs degen culture
- Regulatory compliance as feature not bug
- McLaren partnership for normie appeal

### Accounts to Engage
- @hedera on announcements
- @jaycoolh for builder content
- @hashpackapp for ecosystem
- Davos/WEF coverage for institutional angle

---

*This document will be updated as I learn more about Hedera and the ecosystem.*
