#!/bin/bash
set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  ATP HCS Sidecar — On-chain Audit Logger"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "═══════════════════════════════════════════════"

# Validate required env vars
for var in HEDERA_OPERATOR_ID HEDERA_OPERATOR_KEY HCS_TOPIC_ID GATEWAY_TOKEN; do
    if [ -z "${!var:-}" ]; then
        echo "ERROR: Missing required env var: $var"
        exit 1
    fi
done

# The sidecar polls the rental agent's gateway API for session history
# and submits new interactions to HCS
RENTAL_API="http://rental-agent:18790"

echo "Waiting for rental agent to be healthy..."
until curl -sf "$RENTAL_API/health" > /dev/null 2>&1; do
    sleep 5
done
echo "Rental agent is up. Starting sidecar loop."

# Run every 5 minutes
while true; do
    echo "[$(date -u '+%H:%M:%S')] Polling rental agent..."

    GATEWAY_URL="$RENTAL_API" \
    GATEWAY_TOKEN="$GATEWAY_TOKEN" \
    HEDERA_OPERATOR_ID="$HEDERA_OPERATOR_ID" \
    HEDERA_OPERATOR_KEY="$HEDERA_OPERATOR_KEY" \
    HCS_TOPIC_ID="$HCS_TOPIC_ID" \
    node /home/sidecar/rental-sidecar.mjs 2>&1 || echo "Sidecar run failed"

    sleep 300
done
