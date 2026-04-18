#!/bin/bash
# ATP Rental Sidecar - Cron wrapper
# Loads Hedera key from macOS Keychain and runs the sidecar
# Usage: */5 * * * * /Users/aite/.openclaw/workspace/scripts/run-sidecar.sh >> /tmp/rental-sidecar.log 2>&1

cd /Users/aite/.openclaw/workspace

export HEDERA_OPERATOR_KEY=$(security find-generic-password -a 'atp-sidecar' -s 'hedera-operator-key' -w login.keychain 2>/dev/null)
export HEDERA_OPERATOR_ID=0.0.10255397

if [ -z "$HEDERA_OPERATOR_KEY" ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ERROR: Could not read key from macOS Keychain"
  exit 1
fi

/opt/homebrew/bin/node scripts/rental-sidecar.mjs
