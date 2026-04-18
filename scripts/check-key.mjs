import { PrivateKey } from "@hashgraph/sdk";
const k = process.env.HEDERA_OPERATOR_KEY;
console.log('Key length:', k?.length);
console.log('Key prefix:', k?.slice(0, 8));

for (const method of ['fromStringDer', 'fromStringECDSA', 'fromStringED25519', 'fromString']) {
  try {
    const p = PrivateKey[method](k);
    console.log(`${method} → OK`);
    console.log(`  Public key: ${p.publicKey.toStringRaw()}`);
    console.log(`  Public DER: ${p.publicKey.toStringDer()}`);
  } catch (e) {
    console.log(`${method} → FAIL: ${e.message.slice(0, 80)}`);
  }
}
