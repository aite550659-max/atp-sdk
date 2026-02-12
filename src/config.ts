/**
 * ATP Configuration constants
 */

export const ATP_VERSION = '1.0';
export const HCS_SCHEMA_VERSION = '2.0';

export const MINIMUM_PRICING = {
  flashBaseFee: 0.07,      // $0.07 minimum (covers escrow creation + margin)
  standardBaseFee: 5.00,   // $5.00 minimum (ensures sustainability)
};

export const DEFAULT_INDEXER_URLS = {
  mainnet: 'https://atp-indexer.hedera.com',
  testnet: 'https://atp-indexer-testnet.hedera.com',
  previewnet: 'https://atp-indexer-preview.hedera.com',
};

export const NETWORK_ACCOUNTS = {
  mainnet: {
    network: '0.0.800',
    treasury: '0.0.8332371',  // ATP Treasury — controlled by Gregg (0.0.8332371-rfdnp)
  },
  testnet: {
    network: '0.0.800',
    treasury: '0.0.801',  // Testnet placeholder
  },
  previewnet: {
    network: '0.0.800',
    treasury: '0.0.801',  // Previewnet placeholder
  },
};

export const TRANSACTION_SPLITS = {
  creator_royalty: 0.05,      // 5%
  network_contribution: 0.02,  // 2%
  atp_treasury: 0.01,          // 1%
  owner_revenue: 0.92,         // 92%
};

// Runtime trust levels (TEE attestation) — kept for future use.
// These describe hardware verification capabilities, not access gates.
export const RUNTIME_TRUST_LEVELS = {
  SELF_ATTESTED: 0,    // Operator claims compliance, any hardware
  TEE_ATTESTED: 1,     // CPU TEE (Intel TDX / AMD SEV)
  GPU_TEE_ATTESTED: 2, // Full pipeline TEE (NVIDIA Blackwell + Intel TDX)
};

// Reputation deltas removed in v1 — reputation system deferred.
// Audit trail is the reputation. Review HCS history to assess an agent.

// Trust tiers removed in v1 — anyone can create, anyone can rent.
// Trust comes from the HCS audit trail, not gatekeeping.
// Tiers may return in v2 if economic staking proves valuable.
