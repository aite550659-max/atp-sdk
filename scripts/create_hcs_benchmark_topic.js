#!/usr/bin/env node
const { Client, TopicCreateTransaction, PrivateKey, AccountId } = require('@hashgraph/sdk');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getOperatorKey() {
  return execSync('security find-generic-password -s hedera-operator-key -w', { encoding: 'utf8' }).trim();
}

(async () => {
  const operatorId = '0.0.10255397';
  const operatorKey = getOperatorKey();
  const client = Client.forMainnet();
  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromStringECDSA(operatorKey));

  const memo = 'Aite HCS Sustained Benchmark Topic';
  const tx = new TopicCreateTransaction().setTopicMemo(memo);
  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  const topicId = receipt.topicId.toString();

  const configPath = path.join(process.cwd(), 'hcs_sustained_config.json');
  const payload = {
    topicId,
    memo,
    createdAt: new Date().toISOString(),
    operatorId,
    notes: 'Dedicated unrestricted benchmark topic for HCS sustained testing. Separate from audit topics and transfer-only sustained testing.'
  };
  fs.writeFileSync(configPath, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  client.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
