import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFundingIntent, updateFundingIntent } from './funding-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELAY_URL = process.env.VAL_RELAY_URL || 'http://localhost:3141';
const COINBASE_CDP_PATH = path.join(__dirname, '..', 'coinbase-cdp.json');
const HBAR_HOT_WALLET = process.env.ATP_HBAR_HOT_WALLET || '0.0.10421318';
const EVM_HOT_WALLET = process.env.ATP_EVM_HOT_WALLET || '0x0868eC02bb536c24694123ec1c2066Af6Ba6D620';

const CRYPTO_OPTIONS = {
  eth: { label: 'ETH', rail: 'crypto', sourceAsset: 'ETH', sourceChain: 'ethereum', estimateAsset: 'eth' },
  sol: { label: 'SOL', rail: 'crypto', sourceAsset: 'SOL', sourceChain: 'solana', estimateAsset: 'sol' },
  btc: { label: 'BTC', rail: 'crypto', sourceAsset: 'BTC', sourceChain: 'bitcoin', estimateAsset: 'btc' },
  usdc_base: {
    label: 'USDC on Base', rail: 'crypto', sourceAsset: 'USDC', sourceChain: 'base', estimateAsset: 'usdc-base', fixedUsd: true,
    hotWallet: { address: EVM_HOT_WALLET, chain: 'base', tokenAddress: '0x833589fCD6EDB6E08f4c7C32D4f71b54bdA02913', decimals: 6 }
  },
  usdc_eth: { label: 'USDC on Ethereum', rail: 'crypto', sourceAsset: 'USDC', sourceChain: 'ethereum', estimateAsset: 'usdc-eth', fixedUsd: true },
  usdt_eth: { label: 'USDT on Ethereum', rail: 'crypto', sourceAsset: 'USDT', sourceChain: 'ethereum', estimateAsset: 'usdt-eth', fixedUsd: true },
  cash_card: { label: 'Card / debit checkout', rail: 'cash', sourceAsset: 'USDC', sourceChain: 'base', estimateAsset: 'usdc-base', fixedUsd: true },
};

function getCoinbaseProjectId() {
  try {
    const raw = JSON.parse(fs.readFileSync(COINBASE_CDP_PATH, 'utf8'));
    return raw.projectId || null;
  } catch {
    return null;
  }
}

function buildCoinbaseOnrampUrl(address, network = 'base') {
  const projectId = getCoinbaseProjectId();
  if (!projectId || !address) return null;
  const url = new URL('https://pay.coinbase.com/buy');
  url.searchParams.set('appId', projectId);
  url.searchParams.set('addresses', JSON.stringify({ [address]: [network] }));
  url.searchParams.set('defaultNetwork', network);
  url.searchParams.set('defaultAsset', network === 'base' ? 'USDC' : 'ETH');
  url.searchParams.set('presetFiatAmount', '5');
  url.searchParams.set('fiatCurrency', 'USD');
  url.searchParams.set('sdkVersion', 'atp-funding-rails');
  return url.toString();
}

async function getUsdPrice(assetId) {
  if (assetId.startsWith('usdc') || assetId.startsWith('usdt')) return 1;

  const ids = { eth: 'ethereum', sol: 'solana', btc: 'bitcoin', hbar: 'hedera-hashgraph' };
  const cgId = ids[assetId];
  if (!cgId) return null;

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
    const data = await res.json();
    return data?.[cgId]?.usd || null;
  } catch {
    return null;
  }
}

function buildQuotedStableAmount(intentId, targetBudgetUsd) {
  const tail = intentId.split('_').pop() || 'aa';
  const seed = [...tail].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const cents = 5 + (seed % 45); // 0.05 → 0.49
  return Number((targetBudgetUsd + cents / 100).toFixed(2));
}

async function pickSourceAmount(option, targetBudgetUsd, intentId) {
  if (option.hotWallet && option.fixedUsd) return buildQuotedStableAmount(intentId, targetBudgetUsd);
  if (option.fixedUsd) return Number(targetBudgetUsd.toFixed(2));
  const price = await getUsdPrice(option.estimateAsset);
  if (!price) throw new Error(`Could not price ${option.label}`);
  return Number(((targetBudgetUsd / price) * 1.03).toFixed(8));
}

async function getHbarHotWalletLiquidityUsd() {
  try {
    const res = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/balances?account.id=${HBAR_HOT_WALLET}`);
    const data = await res.json();
    const hbar = ((data.balances || [])[0]?.balance || 0) / 1e8;
    const price = await getUsdPrice('hbar');
    return hbar * (price || 0);
  } catch {
    return 0;
  }
}

async function getEstimate(from, amount) {
  const url = new URL(`${RELAY_URL}/v1/swap/estimate`);
  url.searchParams.set('from', from);
  if (amount) url.searchParams.set('amount', String(amount));
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `Estimate failed for ${from}`);
  return data;
}

async function createSwap(from, amount, accountId, payoutMemo) {
  const res = await fetch(`${RELAY_URL}/v1/swap/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, amount, accountId, payoutMemo })
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Swap creation failed');
  return data;
}

export function getFundingOption(optionKey) {
  return CRYPTO_OPTIONS[optionKey] || null;
}

export async function createRailIntent(intentId, optionKey, accountId) {
  const option = getFundingOption(optionKey);
  if (!option) throw new Error(`Unsupported funding option: ${optionKey}`);
  const intent = getFundingIntent(intentId);
  if (!intent) throw new Error(`Unknown intent: ${intentId}`);

  const requestedAmount = await pickSourceAmount(option, intent.targetBudgetUsd || 5, intent.intentId);

  if (option.hotWallet) {
    const hotWalletUsd = await getHbarHotWalletLiquidityUsd();
    if (hotWalletUsd >= (intent.targetBudgetUsd || 5)) {
      return updateFundingIntent(intentId, {
        paymentMethod: option.rail,
        sourceAsset: option.sourceAsset,
        sourceChain: option.sourceChain,
        status: 'awaiting_payment',
        metadata: {
          ...(intent.metadata || {}),
          railOption: optionKey,
          railLabel: `${option.label} (prefunded)` ,
          prefundedHotWallet: true,
          hotWalletAddress: option.hotWallet.address,
          hotWalletChain: option.hotWallet.chain,
          hotWalletTokenAddress: option.hotWallet.tokenAddress,
          hotWalletTokenDecimals: option.hotWallet.decimals,
          hbarHotWallet: HBAR_HOT_WALLET,
          expectedSourceAmount: requestedAmount,
          expectedSourceAsset: option.sourceAsset,
          expectedSourceChain: option.sourceChain,
          rebalancePending: false,
        },
      }, `rail_selected:${optionKey}:prefunded`);
    }
  }

  const estimate = await getEstimate(option.estimateAsset, requestedAmount);
  const amount = Math.max(Number(estimate.minAmount || 0), requestedAmount);
  const swap = await createSwap(option.estimateAsset, amount, accountId, intent.memo || '');

  const metadata = {
    ...(intent.metadata || {}),
    railOption: optionKey,
    railLabel: option.label,
    relayUrl: RELAY_URL,
    swapId: swap.swapId,
    swapStatus: swap.status || 'waiting',
    swapDepositAddress: swap.depositAddress,
    swapDepositMemo: swap.depositMemo || null,
    estimatedHbar: swap.estimatedHbar || estimate.estimatedHbar || null,
    estimatedSourceAmount: amount,
    onrampUrl: option.rail === 'cash' ? buildCoinbaseOnrampUrl(swap.depositAddress, 'base') : null,
  };

  return updateFundingIntent(intentId, {
    paymentMethod: option.rail,
    sourceAsset: option.sourceAsset,
    sourceChain: option.sourceChain,
    status: 'awaiting_payment',
    metadata,
  }, `rail_selected:${optionKey}`);
}
