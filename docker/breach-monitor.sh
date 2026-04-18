#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ATP Breach Monitor
# Runs inside the rental container. Watches for anomalies that suggest
# a renter has escaped the sandbox or is attempting privilege escalation.
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail

LOG="/tmp/breach-monitor.log"
ALERT_ENDPOINT="${BREACH_ALERT_URL:-}"  # Owner's webhook for breach alerts
MONITOR_URL="${ATP_MONITOR_URL:-}"      # ATP Monitor API for alert ingestion
RENTAL_ID="${ATP_RENTAL_ID:-unknown}"
CHECK_INTERVAL=30  # seconds

echo "[breach-monitor] Started at $(date -u)" >> "$LOG"

# Wait for entrypoint config injection to complete before baseline
sleep 20
echo "[breach-monitor] Baseline check starting" >> "$LOG"

while true; do
    BREACH_DETECTED=false
    BREACH_REASON=""

    # ── Check 1: Process anomalies ───────────────────────────────────────────
    # Only expected processes should be running. Flag anything suspicious.
    UNEXPECTED=$(ps aux | grep -v -E '(node|openclaw|breach-monitor|ps|grep|bash|sleep|curl|jq|ss|sha256sum|awk|cat|runc|tini)' | grep -v 'USER' | grep -v 'PID' | grep -v '^\s*$' || true)
    if [ -n "$UNEXPECTED" ]; then
        BREACH_DETECTED=true
        BREACH_REASON="Unexpected processes: $UNEXPECTED"
    fi

    # ── Check 2: Network connections to unexpected destinations ──────────────
    # Allowed outbound: Telegram (149.154.x.x), Anthropic (API), Brave, Hedera, DNS
    # Flag connections to OTHER private/internal IPs (potential lateral movement to host)
    # Exclude: container's own bridge IP (192.168.x.x outbound is normal for Docker)
    CONTAINER_IP=$(hostname -i 2>/dev/null || echo "192.168")
    CONTAINER_SUBNET=$(echo "$CONTAINER_IP" | cut -d. -f1-2)

    # Only flag private IPs that are NOT the container's own subnet and NOT localhost
    SUSPICIOUS_NET=$(ss -tn 2>/dev/null | grep 'ESTAB' | awk '{print $5}' | \
        grep -E '^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' | \
        grep -v "^${CONTAINER_SUBNET}\." | \
        grep -v '^127\.' || true)
    if [ -n "$SUSPICIOUS_NET" ]; then
        BREACH_DETECTED=true
        BREACH_REASON="${BREACH_REASON:+$BREACH_REASON | }Suspicious lateral network: $SUSPICIOUS_NET"
    fi

    # ── Check 3: File system tampering ───────────────────────────────────────
    # Check if SOUL.md or AGENTS.md have been modified
    if [ -f /home/rental/.openclaw/workspace/SOUL.md ]; then
        CURRENT_HASH=$(sha256sum /home/rental/.openclaw/workspace/SOUL.md | awk '{print $1}')
        if [ -f /tmp/.soul_hash ]; then
            ORIGINAL_HASH=$(cat /tmp/.soul_hash)
            if [ "$CURRENT_HASH" != "$ORIGINAL_HASH" ]; then
                BREACH_DETECTED=true
                BREACH_REASON="${BREACH_REASON:+$BREACH_REASON | }SOUL.md modified"
            fi
        else
            echo "$CURRENT_HASH" > /tmp/.soul_hash
        fi
    fi

    if [ -f /home/rental/.openclaw/workspace/AGENTS.md ]; then
        CURRENT_HASH=$(sha256sum /home/rental/.openclaw/workspace/AGENTS.md | awk '{print $1}')
        if [ -f /tmp/.agents_hash ]; then
            ORIGINAL_HASH=$(cat /tmp/.agents_hash)
            if [ "$CURRENT_HASH" != "$ORIGINAL_HASH" ]; then
                BREACH_DETECTED=true
                BREACH_REASON="${BREACH_REASON:+$BREACH_REASON | }AGENTS.md modified"
            fi
        else
            echo "$CURRENT_HASH" > /tmp/.agents_hash
        fi
    fi

    # ── Check 4: OpenClaw config tampering ───────────────────────────────────
    if [ -f /home/rental/.openclaw/openclaw.json ]; then
        CURRENT_HASH=$(sha256sum /home/rental/.openclaw/openclaw.json | awk '{print $1}')
        if [ -f /tmp/.config_hash ]; then
            ORIGINAL_HASH=$(cat /tmp/.config_hash)
            if [ "$CURRENT_HASH" != "$ORIGINAL_HASH" ]; then
                BREACH_DETECTED=true
                BREACH_REASON="${BREACH_REASON:+$BREACH_REASON | }openclaw.json modified"
            fi
        else
            echo "$CURRENT_HASH" > /tmp/.config_hash
        fi
    fi

    # ── Alert if breach detected ─────────────────────────────────────────────
    if [ "$BREACH_DETECTED" = true ]; then
        TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
        ALERT_MSG="🚨 BREACH DETECTED in rental container at $TIMESTAMP — $BREACH_REASON"
        echo "[breach-monitor] $ALERT_MSG" >> "$LOG"

        # Send alert to owner webhook if configured
        if [ -n "$ALERT_ENDPOINT" ]; then
            curl -sf -X POST "$ALERT_ENDPOINT" \
                -H "Content-Type: application/json" \
                -d "{\"type\":\"security.breach\",\"timestamp\":\"$TIMESTAMP\",\"reason\":\"$BREACH_REASON\"}" \
                >> "$LOG" 2>&1 || true
        fi

        # Send alert to ATP Monitor if configured
        if [ -n "$MONITOR_URL" ]; then
            curl -sf -X POST "${MONITOR_URL}/api/alerts" \
                -H "Content-Type: application/json" \
                -d "{\"rentalId\":\"$RENTAL_ID\",\"type\":\"security.breach\",\"message\":\"$BREACH_REASON\"}" \
                >> "$LOG" 2>&1 || true
        fi

        # Log to stderr so it shows in docker logs
        echo "$ALERT_MSG" >&2
    fi

    sleep "$CHECK_INTERVAL"
done
