#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { mnemonicToAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, encodeFunctionData, erc20Abi, getAddress, http, parseEther, parseUnits, formatEther } from 'viem';
import { base, mainnet } from 'viem/chains';

const CHAIN_CONFIG = {
  ethereum: { chain: mainnet, rpcUrl: 'https://ethereum-rpc.publicnode.com' },
  base: { chain: base, rpcUrl: 'https://mainnet.base.org' },
};

const TOKENS = {
  eth: { kind: 'native', decimals: 18, chain: 'ethereum' },
  'usdc-eth': { kind: 'erc20', decimals: 6, chain: 'ethereum', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  'usdt-eth': { kind: 'erc20', decimals: 6, chain: 'ethereum', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  'usdc-base': { kind: 'erc20', decimals: 6, chain: 'base', address: '0x833589fCD6EDB6E08f4c7C32D4f71b54bdA02913' },
};

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function requireArg(name) {
  const value = arg(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function loadMnemonic() {
  return execSync('security find-generic-password -s val-wallet-mnemonic -w', { encoding: 'utf8' }).trim();
}

async function main() {
  const asset = requireArg('--asset').toLowerCase();
  const to = getAddress(requireArg('--to'));
  const amount = requireArg('--amount');
  const token = TOKENS[asset];
  if (!token) throw new Error(`Unsupported asset: ${asset}`);

  const chainConfig = CHAIN_CONFIG[token.chain];
  const account = mnemonicToAccount(loadMnemonic());
  const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpcUrl) });
  const walletClient = createWalletClient({ account, chain: chainConfig.chain, transport: http(chainConfig.rpcUrl) });

  let hash;
  if (token.kind === 'native') {
    hash = await walletClient.sendTransaction({
      account,
      to,
      value: parseEther(amount),
      chain: chainConfig.chain,
    });
  } else {
    hash = await walletClient.sendTransaction({
      account,
      to: getAddress(token.address),
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, parseUnits(amount, token.decimals)] }),
      chain: chainConfig.chain,
    });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const balance = await publicClient.getBalance({ address: account.address });

  console.log(JSON.stringify({
    from: account.address,
    to,
    asset,
    chain: token.chain,
    amount,
    hash,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
    nativeBalanceAfter: formatEther(balance),
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
