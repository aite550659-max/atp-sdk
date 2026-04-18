#!/bin/bash
set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  ATP Rental Agent — Containerized Instance"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "═══════════════════════════════════════════════"

# ── Validate required env vars ───────────────────────────────────────────────
required_vars=(
    "ANTHROPIC_API_KEY"
    "BRAVE_API_KEY"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var:-}" ]; then
        echo "ERROR: Missing required env var: $var"
        exit 1
    fi
done

# ── Inject secrets into OpenClaw config ──────────────────────────────────────
# Replace placeholders in the config with actual env values
CONFIG_PATH="$HOME/.openclaw/openclaw.json"

# Use jq to safely inject secrets
GW_TOKEN="${GATEWAY_TOKEN:-$(openssl rand -hex 16)}"
RUNTIME_MODEL="${ATP_MODEL_PREFERENCE:-sonnet}"

jq --arg brave "${BRAVE_API_KEY}" \
   --arg gw_token "$GW_TOKEN" \
   --arg runtime_model "$RUNTIME_MODEL" \
   '
   .tools.web.search.apiKey = $brave |
   .gateway.auth.token = $gw_token |
   .agents.defaults.model.primary = $runtime_model
   ' "$CONFIG_PATH" > "${CONFIG_PATH}.tmp" && mv "${CONFIG_PATH}.tmp" "$CONFIG_PATH"

# Write Anthropic key to auth-profiles (where OpenClaw actually reads it)
mkdir -p "$HOME/.openclaw/agents/main/agent"
# Build auth profiles dynamically based on available keys
AUTH_JSON='{"version":1,"profiles":{"anthropic:default":{"type":"api_key","provider":"anthropic","key":"'"$ANTHROPIC_API_KEY"'"}'
if [ -n "${OPENAI_API_KEY:-}" ]; then
  AUTH_JSON="$AUTH_JSON,\"openai:default\":{\"type\":\"api_key\",\"provider\":\"openai\",\"key\":\"$OPENAI_API_KEY\"}"
fi
AUTH_JSON="$AUTH_JSON}}"
echo "$AUTH_JSON" | jq . > "$HOME/.openclaw/agents/main/agent/auth-profiles.json"

echo "Config injected. Starting OpenClaw gateway..."

# ── Start breach monitor in background ───────────────────────────────────────
/home/rental/breach-monitor.sh &
MONITOR_PID=$!

# ── Trap signals for clean shutdown ──────────────────────────────────────────
cleanup() {
    echo "Shutting down rental agent..."
    kill $MONITOR_PID 2>/dev/null || true
    openclaw gateway stop 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# ── Start OpenClaw ───────────────────────────────────────────────────────────
export NODE_OPTIONS="--max-old-space-size=512"
openclaw gateway run

# If gateway exits, clean up
cleanup
