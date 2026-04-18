const { PrivateKey } = require('@hashgraph/sdk');
const fs = require('fs');
const path = require('path');

async function createTestnetAccount() {
  console.log('🔑 Generating ED25519 key pair...');
  const privateKey = PrivateKey.generateED25519();
  const publicKey = privateKey.publicKey;

  console.log('Private Key:', privateKey.toString());
  console.log('Public Key:', publicKey.toString());

  console.log('\n🌐 Requesting account from testnet faucet...');

  try {
    const response = await fetch('https://faucet.testnet.hedera.com/api/v1/account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publicKey: publicKey.toString()
      })
    });

    if (!response.ok) {
      throw new Error(`Faucet request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Account created!');
    console.log('Account ID:', data.accountId);

    const accountData = {
      accountId: data.accountId,
      privateKey: privateKey.toString(),
      publicKey: publicKey.toString(),
      network: 'testnet',
      createdAt: new Date().toISOString()
    };

    const outputPath = '/Users/aite/.openclaw/workspace/data/atp-testnet.json';
    fs.writeFileSync(outputPath, JSON.stringify(accountData, null, 2));
    console.log(`\n💾 Account data saved to: ${outputPath}`);

    return accountData;
  } catch (error) {
    console.error('❌ Error creating account:', error.message);
    throw error;
  }
}

createTestnetAccount()
  .then(account => {
    console.log('\n✨ Testnet account ready!');
    console.log(JSON.stringify(account, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
