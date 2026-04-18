# ATP Rental Agent — Containerized OpenClaw Instance
# Completely isolated from owner agent. No shared filesystem, no shared process.
#
# Build:  docker build -t atp-rental -f docker/Dockerfile .
# Run:    docker run -d --name atp-rental --env-file docker/.env atp-rental

FROM node:22-slim AS base

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl jq git procps iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally (latest version to support all current models)
RUN npm install -g openclaw@latest

# Create non-root user for the rental agent
RUN useradd -m -s /bin/bash rental

# ── Workspace setup ──────────────────────────────────────────────────────────
USER rental
WORKDIR /home/rental

# Create OpenClaw directory structure
RUN mkdir -p .openclaw/workspace

# Copy rental workspace files (SOUL, AGENTS, IDENTITY, etc.)
COPY --chown=rental:rental rental/SOUL.md     .openclaw/workspace/SOUL.md
COPY --chown=rental:rental rental/AGENTS.md   .openclaw/workspace/AGENTS.md
COPY --chown=rental:rental rental/IDENTITY.md .openclaw/workspace/IDENTITY.md
COPY --chown=rental:rental rental/TOOLS.md    .openclaw/workspace/TOOLS.md
COPY --chown=rental:rental rental/USER.md     .openclaw/workspace/USER.md
COPY --chown=rental:rental rental/HEARTBEAT.md .openclaw/workspace/HEARTBEAT.md

# Copy container-specific OpenClaw config
COPY --chown=rental:rental docker/openclaw-rental.json .openclaw/openclaw.json

# Copy the breach detection script
COPY --chown=rental:rental docker/breach-monitor.sh /home/rental/breach-monitor.sh
RUN chmod +x /home/rental/breach-monitor.sh

# Copy entrypoint
COPY --chown=rental:rental docker/entrypoint.sh /home/rental/entrypoint.sh
RUN chmod +x /home/rental/entrypoint.sh

# ── Runtime ──────────────────────────────────────────────────────────────────
# No volume mounts to host filesystem
# No access to host network (use bridge)
# No privileged mode

EXPOSE 18790

# Health check — OpenClaw gateway responds
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=2 \
    CMD curl -sf http://localhost:18790/health || exit 1

ENTRYPOINT ["/home/rental/entrypoint.sh"]
