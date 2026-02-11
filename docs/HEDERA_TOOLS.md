# Hedera Tools & SDKs Reference

**Document Created:** February 4, 2026  
**Installation Date:** February 4, 2026  
**Workspace:** ~/.openclaw/workspace

## Overview

This document catalogs all installed Hedera SDKs, tools, and their usage patterns. All major SDKs have been cloned to `~/.openclaw/workspace/repos/` for reference and development.

---

## Installed SDKs & Versions

### ✅ 1. JavaScript/TypeScript SDK (@hashgraph/sdk)

**Version:** 2.80.0 (Latest as of Feb 2026)  
**Installation:** Local npm package in workspace  
**Status:** ✅ Verified  
**Repository:** https://github.com/hiero-ledger/hiero-sdk-js

#### Installation
```bash
npm install @hashgraph/sdk
```

#### Quick Start
```typescript
import { Client, PrivateKey, AccountCreateTransaction, Hbar } from "@hashgraph/sdk";

// Configure client for testnet
const client = Client.forTestnet();
client.setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!)
);

// Create a new account
async function createAccount() {
    const newAccountPrivateKey = PrivateKey.generateECDSA();
    const newAccountPublicKey = newAccountPrivateKey.publicKey;

    const transaction = new AccountCreateTransaction()
        .setKey(newAccountPublicKey)
        .setInitialBalance(new Hbar(10));

    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const newAccountId = receipt.accountId;

    console.log(`New account ID: ${newAccountId}`);
    return newAccountId;
}
```

#### Common Operations
```typescript
// Transfer HBAR
import { TransferTransaction } from "@hashgraph/sdk";

const transaction = new TransferTransaction()
    .addHbarTransfer("0.0.123", new Hbar(-10))
    .addHbarTransfer("0.0.456", new Hbar(10));

const txResponse = await transaction.execute(client);
const receipt = await txResponse.getReceipt(client);

// Create a token (HTS)
import { TokenCreateTransaction, TokenType } from "@hashgraph/sdk";

const tokenTx = new TokenCreateTransaction()
    .setTokenName("My Token")
    .setTokenSymbol("MTK")
    .setDecimals(2)
    .setInitialSupply(1000000)
    .setTreasuryAccountId(client.operatorAccountId!)
    .setAdminKey(client.operatorPublicKey!)
    .setFreezeDefault(false);

const tokenResponse = await tokenTx.execute(client);
const tokenReceipt = await tokenResponse.getReceipt(client);
const tokenId = tokenReceipt.tokenId;

// Create a topic (HCS)
import { TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hashgraph/sdk";

const topicTx = new TopicCreateTransaction();
const topicResponse = await topicTx.execute(client);
const topicReceipt = await topicResponse.getReceipt(client);
const topicId = topicReceipt.topicId;

// Submit message to topic
const messageTx = new TopicMessageSubmitTransaction({
    topicId: topicId,
    message: "Hello, Hedera!",
});
await messageTx.execute(client);
```

#### Documentation
- **Official Docs:** https://docs.hedera.com/hedera/sdks-and-apis/sdks/javascript
- **API Reference:** https://docs.hedera.com/hedera/sdks-and-apis/sdks/javascript/api-reference
- **Examples:** https://github.com/hiero-ledger/hiero-sdk-js/tree/main/examples

---

### ✅ 2. Hedera Agent Kit (JavaScript/TypeScript)

**Version:** 3.7.1 (Latest - v3 rewrite)  
**Installation:** Available via npm and cloned locally  
**Status:** ✅ Verified  
**Repository:** https://github.com/hashgraph/hedera-agent-kit-js

#### Installation
```bash
npm install hedera-agent-kit @langchain/core langchain @langchain/langgraph @langchain/openai @hashgraph/sdk dotenv
```

#### Quick Start
```typescript
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit, AgentMode } from 'hedera-agent-kit';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

// Setup Hedera client
const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!)
);

// Initialize Agent Kit toolkit
const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
        tools: [], // Auto-loads core tools
        plugins: [], // Add third-party plugins
        context: {
            mode: AgentMode.AUTONOMOUS, // or AgentMode.RETURN_BYTES
        },
    },
});

const tools = hederaAgentToolkit.getTools();

// Create LLM-powered agent
const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
});

const agent = createAgent({
    model: llm,
    tools: tools,
    systemPrompt: 'You are a helpful Hedera blockchain assistant',
    checkpointer: new MemorySaver(),
});

// Execute agent query
const response = await agent.invoke(
    { messages: [{ role: 'user', content: "What's my balance?" }] },
    { configurable: { thread_id: '1' } }
);

console.log(response.messages[response.messages.length - 1].content);
```

#### Available Core Plugins & Tools

**Core Account Plugin:**
- `transfer_hbar` - Send HBAR to another account

**Core Consensus Plugin:**
- `create_topic` - Create HCS topic
- `submit_message` - Submit message to topic

**Core HTS Plugin:**
- `create_fungible_token` - Create fungible token
- `create_nft` - Create non-fungible token
- `airdrop_tokens` - Airdrop tokens to accounts

**Core Queries Plugin:**
- `get_account` - Query account information
- `get_hbar_balance` - Get HBAR balance
- `get_token_balances` - Get token balances
- `get_topic_messages` - Query HCS messages

#### Third-Party Plugins

Install community plugins for extended functionality:

```bash
# SaucerSwap DEX
npm install hak-saucerswap-plugin

# Bonzo Finance lending
npm install @bonzofinancelabs/hak-bonzo-plugin

# Memejob meme tokens
npm install @buidlerlabs/hak-memejob-plugin

# Pyth price feeds
npm install hak-pyth-plugin

# CoinCap market data
npm install coincap-hedera-plugin

# Chainlink price feeds
npm install chainlink-pricefeed-plugin
```

#### Documentation
- **Official Docs:** https://docs.hedera.com/hedera/open-source-solutions/ai-studio-on-hedera
- **GitHub README:** https://github.com/hashgraph/hedera-agent-kit-js/blob/main/README.md
- **Plugin Guide:** https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/PLUGINS.md
- **Examples:** https://github.com/hashgraph/hedera-agent-kit-js/tree/main/examples

---

### ✅ 3. Java SDK (hiero-sdk-java)

**Version:** 2.66.0  
**Installation:** Cloned to `~/.openclaw/workspace/repos/hiero-sdk-java`  
**Status:** ✅ Available (requires Gradle build)  
**Repository:** https://github.com/hiero-ledger/hiero-sdk-java

#### Maven Installation
```xml
<dependency>
    <groupId>com.hedera.hashgraph</groupId>
    <artifactId>sdk</artifactId>
    <version>2.66.0</version>
</dependency>
```

#### Gradle Installation
```gradle
implementation 'com.hedera.hashgraph:sdk:2.66.0'
```

#### Quick Start
```java
import com.hedera.hashgraph.sdk.*;
import io.github.cdimascio.dotenv.Dotenv;

public class HederaExample {
    public static void main(String[] args) throws Exception {
        // Load environment
        Dotenv dotenv = Dotenv.load();
        AccountId accountId = AccountId.fromString(dotenv.get("ACCOUNT_ID"));
        PrivateKey privateKey = PrivateKey.fromString(dotenv.get("PRIVATE_KEY"));

        // Create client
        Client client = Client.forTestnet();
        client.setOperator(accountId, privateKey);

        // Create new account
        PrivateKey newAccountPrivateKey = PrivateKey.generateECDSA();
        PublicKey newAccountPublicKey = newAccountPrivateKey.getPublicKey();

        TransactionResponse txResponse = new AccountCreateTransaction()
            .setKey(newAccountPublicKey)
            .setInitialBalance(new Hbar(10))
            .execute(client);

        TransactionReceipt receipt = txResponse.getReceipt(client);
        AccountId newAccountId = receipt.accountId;

        System.out.println("New account ID: " + newAccountId);

        client.close();
    }
}
```

#### Common Operations
```java
// Transfer HBAR
new TransferTransaction()
    .addHbarTransfer(AccountId.fromString("0.0.123"), new Hbar(-10))
    .addHbarTransfer(AccountId.fromString("0.0.456"), new Hbar(10))
    .execute(client)
    .getReceipt(client);

// Create token
TokenCreateTransaction tokenTx = new TokenCreateTransaction()
    .setTokenName("My Token")
    .setTokenSymbol("MTK")
    .setDecimals(2)
    .setInitialSupply(1000000)
    .setTreasuryAccountId(client.getOperatorAccountId())
    .setAdminKey(client.getOperatorPublicKey());

TransactionResponse tokenResponse = tokenTx.execute(client);
TokenId tokenId = tokenResponse.getReceipt(client).tokenId;

// Create topic
TopicCreateTransaction topicTx = new TopicCreateTransaction();
TransactionResponse topicResponse = topicTx.execute(client);
TopicId topicId = topicResponse.getReceipt(client).topicId;
```

#### Documentation
- **Official Docs:** https://docs.hedera.com/hedera/sdks-and-apis/sdks/java
- **Quickstart:** https://github.com/hiero-ledger/hiero-sdk-java/blob/main/docs/java-app/java-app-quickstart.md
- **Examples:** https://github.com/hiero-ledger/hiero-sdk-java/tree/main/examples

---

### ✅ 4. Go SDK (hiero-sdk-go)

**Version:** 2.74.0  
**Installation:** Cloned to `~/.openclaw/workspace/repos/hiero-sdk-go`  
**Status:** ✅ Available  
**Repository:** https://github.com/hiero-ledger/hiero-sdk-go

#### Installation
```bash
go get github.com/hiero-ledger/hiero-sdk-go/v2@latest
```

#### Quick Start
```go
package main

import (
    "fmt"
    "os"
    
    "github.com/hiero-ledger/hiero-sdk-go/v2"
    "github.com/joho/godotenv"
)

func main() {
    // Load .env
    godotenv.Load()
    
    accountID, _ := hedera.AccountIDFromString(os.Getenv("ACCOUNT_ID"))
    privateKey, _ := hedera.PrivateKeyFromString(os.Getenv("PRIVATE_KEY"))
    
    // Create client
    client := hedera.ClientForTestnet()
    client.SetOperator(accountID, privateKey)
    
    // Create new account
    newKey, _ := hedera.GeneratePrivateKey()
    
    txResponse, err := hedera.NewAccountCreateTransaction().
        SetKey(newKey.PublicKey()).
        SetInitialBalance(hedera.NewHbar(10)).
        Execute(client)
    
    if err != nil {
        panic(err)
    }
    
    receipt, err := txResponse.GetReceipt(client)
    if err != nil {
        panic(err)
    }
    
    fmt.Println("New account ID:", *receipt.AccountID)
    
    client.Close()
}
```

#### Common Operations
```go
// Transfer HBAR
_, err := hedera.NewTransferTransaction().
    AddHbarTransfer(hedera.AccountID{Account: 123}, hedera.NewHbar(-10)).
    AddHbarTransfer(hedera.AccountID{Account: 456}, hedera.NewHbar(10)).
    Execute(client)

// Create token
txResponse, err := hedera.NewTokenCreateTransaction().
    SetTokenName("My Token").
    SetTokenSymbol("MTK").
    SetDecimals(2).
    SetInitialSupply(1000000).
    SetTreasuryAccountID(client.GetOperatorAccountID()).
    SetAdminKey(client.GetOperatorPublicKey()).
    Execute(client)

receipt, _ := txResponse.GetReceipt(client)
tokenID := *receipt.TokenID

// Create topic
topicTx, _ := hedera.NewTopicCreateTransaction().Execute(client)
topicReceipt, _ := topicTx.GetReceipt(client)
topicID := *topicReceipt.TopicID
```

#### Documentation
- **Official Docs:** https://docs.hedera.com/hedera/sdks-and-apis/sdks/go
- **GoDoc:** https://pkg.go.dev/github.com/hiero-ledger/hiero-sdk-go/v2
- **Examples:** https://github.com/hiero-ledger/hiero-sdk-go/tree/main/examples

---

### ✅ 5. Swift SDK (hiero-sdk-swift)

**Version:** 0.47.0 (Swift 6.0, 6.1, 6.2 support)  
**Installation:** Cloned to `~/.openclaw/workspace/repos/hiero-sdk-swift`  
**Status:** ✅ Available  
**Repository:** https://github.com/hiero-ledger/hiero-sdk-swift  
**Platform:** iOS 13+, macOS 10.15+

#### Swift Package Manager
Add to `Package.swift`:
```swift
dependencies: [
    .package(url: "https://github.com/hiero-ledger/hiero-sdk-swift", from: "0.47.0")
]
```

#### Quick Start
```swift
import Hiero
import Foundation

// Setup client
let client = try await Client.forTestnet()
let accountId = try AccountId.fromString(ProcessInfo.processInfo.environment["ACCOUNT_ID"]!)
let privateKey = try PrivateKey.fromString(ProcessInfo.processInfo.environment["PRIVATE_KEY"]!)

client.setOperator(accountId, privateKey)

// Create new account
let newKey = PrivateKey.generateEcdsa()

let transaction = AccountCreateTransaction()
    .key(.single(newKey.publicKey))
    .initialBalance(Hbar(10))

let response = try await transaction.execute(client)
let receipt = try await response.getReceipt(client)

print("New account ID: \(receipt.accountId!)")
```

#### Common Operations
```swift
// Transfer HBAR
let transferTx = TransferTransaction()
    .hbarTransfer(AccountId(num: 123), Hbar(-10))
    .hbarTransfer(AccountId(num: 456), Hbar(10))

try await transferTx.execute(client)

// Create token
let tokenTx = TokenCreateTransaction()
    .name("My Token")
    .symbol("MTK")
    .decimals(2)
    .initialSupply(1_000_000)
    .treasuryAccountId(client.operatorAccountId!)
    .adminKey(.single(client.operatorPublicKey!))

let tokenResponse = try await tokenTx.execute(client)
let tokenReceipt = try await tokenResponse.getReceipt(client)
let tokenId = tokenReceipt.tokenId!

// Create topic
let topicTx = TopicCreateTransaction()
let topicResponse = try await topicTx.execute(client)
let topicReceipt = try await topicResponse.getReceipt(client)
let topicId = topicReceipt.topicId!
```

#### Documentation
- **Official Page:** https://hedera.com/open-source/project/swift-sdk
- **API Docs:** https://github.com/hiero-ledger/hiero-sdk-swift/tree/main/docs
- **Examples:** https://github.com/hiero-ledger/hiero-sdk-swift/tree/main/Examples

---

### ❌ 6. Python SDK

**Status:** ⚠️ No official SDK (archived community project)  
**Last Activity:** March 2021  
**Repository:** https://github.com/launchbadge/hedera-sdk-python (archived)

**Alternatives:**
1. Use JavaScript SDK via Node.js subprocess
2. Use REST API via Mirror Node endpoints
3. Build custom wrapper using gRPC Protobufs

**Mirror Node REST API (Python-friendly):**
```python
import requests

# Get account balance
response = requests.get(
    "https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.123"
)
account_data = response.json()

# Get transactions
tx_response = requests.get(
    "https://testnet.mirrornode.hedera.com/api/v1/transactions",
    params={"account.id": "0.0.123", "limit": 10}
)
transactions = tx_response.json()
```

---

## Additional Tools & Resources

### 🔧 Development Tools

#### Hedera Developer Playground
**URL:** https://portal.hedera.com/playground  
**Description:** Interactive browser-based environment for testing SDK code  
**Features:**
- No local setup required
- Pre-configured testnet access
- Code examples for all services
- Live execution and results

#### Mirror Node APIs
**Testnet:** https://testnet.mirrornode.hedera.com  
**Mainnet:** https://mainnet.mirrornode.hedera.com  
**Purpose:** Query historical network data  
**Data Available:**
- Account information
- Transaction history
- Token data
- Smart contract details
- HCS topic messages

**Example Queries:**
```bash
# Get account info
curl https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.123

# Get account tokens
curl https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.123/tokens

# Get topic messages
curl https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.456/messages

# Get transactions
curl https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=0.0.123
```

#### HashScan Explorer
**Testnet:** https://hashscan.io/testnet  
**Mainnet:** https://hashscan.io/mainnet  
**Features:** Visual network explorer, transaction lookup, account search

#### JSON-RPC Relay (EVM Compatibility)
**Documentation:** https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay  
**Purpose:** Use Ethereum tools (Web3.js, Ethers, Hardhat, Foundry) with Hedera

**Endpoints:**
- Testnet: https://testnet.hashio.io/api
- Mainnet: https://mainnet.hashio.io/api

#### Solo (Local Development Network)
**Repository:** https://github.com/hiero-ledger/solo  
**Documentation:** https://solo.hiero.org  
**Purpose:** CLI tool to run local Hedera network with Docker  
**Features:**
- Full consensus + mirror node setup
- Fast local testing
- No testnet HBAR costs

---

### 📚 Key Documentation Links

**Core Documentation:**
- Main Docs: https://docs.hedera.com
- Getting Started: https://docs.hedera.com/hedera/getting-started-hedera-native-developers
- API Reference: https://docs.hedera.com/hedera/sdks-and-apis

**Network Services:**
- Token Service (HTS): https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service
- Consensus Service (HCS): https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service
- Smart Contracts (HSCS): https://docs.hedera.com/hedera/core-concepts/smart-contracts

**AI Development:**
- AI Studio: https://docs.hedera.com/hedera/open-source-solutions/ai-studio-on-hedera
- Agent Kit Guide: https://docs.hedera.com/hedera/open-source-solutions/ai-studio-on-hedera/hedera-ai-agent-kit
- MCP Server: https://docs.hedera.com/hedera/open-source-solutions/ai-studio-on-hedera/hedera-mcp-server

**Community:**
- Discord: http://hedera.com/discord
- GitHub Discussions: https://github.com/orgs/hiero-ledger/discussions
- Developer Blog: https://hedera.com/blog

---

## Environment Setup

### Required Environment Variables
Create a `.env` file in your project root:

```bash
# Hedera Testnet Account
ACCOUNT_ID=0.0.xxxxx
PRIVATE_KEY=0x... # ECDSA format

# AI/LLM Keys (for Agent Kit)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...

# Network Selection (optional)
HEDERA_NETWORK=testnet # testnet, mainnet, or previewnet
```

### Getting Testnet Credentials
1. Visit https://portal.hedera.com/dashboard
2. Sign up for free developer account
3. Receive testnet HBAR (10,000 HBAR)
4. Copy Account ID and Private Key to `.env`

---

## SDK Version Summary

| SDK | Version | Status | Repository |
|-----|---------|--------|------------|
| JavaScript/TypeScript | 2.80.0 | ✅ Current | hiero-ledger/hiero-sdk-js |
| Hedera Agent Kit | 3.7.1 | ✅ Current | hashgraph/hedera-agent-kit-js |
| Java | 2.66.0 | ✅ Current | hiero-ledger/hiero-sdk-java |
| Go | 2.74.0 | ✅ Current | hiero-ledger/hiero-sdk-go |
| Swift | 0.47.0 | ✅ Current | hiero-ledger/hiero-sdk-swift |
| Python | N/A | ❌ Archived | launchbadge/hedera-sdk-python |

---

## Quick Reference: Common Tasks

### Get Account Balance
```typescript
// JS/TS
const balance = await client.getAccountBalance(accountId);
console.log(balance.hbars.toString());
```

```java
// Java
Hbar balance = new AccountBalanceQuery()
    .setAccountId(accountId)
    .execute(client)
    .hbars;
```

```go
// Go
balance, _ := hedera.NewAccountBalanceQuery().
    SetAccountID(accountId).
    Execute(client)
fmt.Println(balance.Hbars.String())
```

### Create & Transfer Token
```typescript
// JS/TS - Create
const tokenId = (await new TokenCreateTransaction()
    .setTokenName("MyToken")
    .setTokenSymbol("MTK")
    .setDecimals(2)
    .setInitialSupply(1000000)
    .execute(client)
).getReceipt(client).tokenId;

// Transfer token
await new TransferTransaction()
    .addTokenTransfer(tokenId, senderId, -100)
    .addTokenTransfer(tokenId, receiverId, 100)
    .execute(client);
```

### Submit HCS Message
```typescript
// JS/TS
const topicId = TopicId.fromString("0.0.123456");
await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage("Hello Hedera!")
    .execute(client);
```

### Deploy Smart Contract
```typescript
// JS/TS
import { FileCreateTransaction, ContractCreateTransaction } from "@hashgraph/sdk";
import fs from "fs";

// Upload bytecode
const bytecode = fs.readFileSync("MyContract.bin");
const fileResponse = await new FileCreateTransaction()
    .setContents(bytecode)
    .execute(client);
const fileId = (await fileResponse.getReceipt(client)).fileId;

// Create contract
const contractResponse = await new ContractCreateTransaction()
    .setBytecodeFileId(fileId)
    .setGas(100000)
    .execute(client);
const contractId = (await contractResponse.getReceipt(client)).contractId;
```

---

## Next Steps

### For Web3 Developers
1. Start with JavaScript SDK - most familiar
2. Explore Agent Kit for AI integration
3. Use JSON-RPC Relay for existing Ethereum tools
4. Deploy smart contracts via Hardhat/Foundry

### For Enterprise Developers
1. Java SDK for backend services
2. Focus on HTS for tokenization
3. HCS for audit logging
4. Review compliance features

### For AI Developers
1. Install Hedera Agent Kit
2. Configure with OpenAI/Anthropic/Groq
3. Explore plugin ecosystem
4. Build autonomous agents

### For Mobile Developers
1. Use Swift SDK for iOS
2. Java SDK for Android
3. Integrate HashPack wallet
4. Build with HTS for in-app tokens

---

**Last Updated:** February 4, 2026  
**Maintained By:** Aite (AI Assistant)  
**Workspace:** ~/.openclaw/workspace
