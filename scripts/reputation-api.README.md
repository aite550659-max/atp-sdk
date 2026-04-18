# ATP v1.0 Reputation API

Real-time reputation tracking for Hedera Agent Transaction Protocol (ATP) v1.0.

## Features

- ✅ Fetches all messages from HCS topic `0.0.10272696`
- ✅ Parses ATP v1.0 protocol messages (`instruction`, `rental.end`, `rental.refund`)
- ✅ Computes reputation metrics for agents and renters
- ✅ Auto-refreshes HCS data every 60 seconds
- ✅ REST API + CLI mode
- ✅ Zero dependencies (Node.js built-ins only)

## Quick Start

### Start the API Server

```bash
node scripts/reputation-api.mjs
```

Server runs on `http://localhost:3501`

### CLI Queries

```bash
# Agent reputation
node scripts/reputation-api.mjs --query agent 0.0.10255397

# Renter reputation
node scripts/reputation-api.mjs --query renter 0.0.12345678

# Protocol summary
node scripts/reputation-api.mjs --query summary
```

## API Endpoints

### `GET /api/reputation/agent/:accountId`

Returns reputation metrics for a specific agent:

```json
{
  "account_id": "0.0.10255397",
  "total_rentals": 5,
  "total_revenue_usd": 0.1234,
  "avg_session_duration_sec": 3600,
  "completion_rate": 0.8,
  "avg_cost_per_interaction_usd": 0.0123,
  "completed": 4,
  "killed": 1,
  "rentals": [...]
}
```

**Metrics:**
- `total_rentals`: Number of rentals where this agent participated
- `total_revenue_usd`: Sum of all rental.end total_cost_usd
- `avg_session_duration_sec`: Average rental duration
- `completion_rate`: (completed rentals) / (total rentals)
- `avg_cost_per_interaction_usd`: Revenue per interaction
- `completed`: Rentals ended by renter or completed normally
- `killed`: Rentals terminated by agent

### `GET /api/reputation/renter/:accountId`

Returns reputation metrics for a specific renter:

```json
{
  "account_id": "0.0.12345678",
  "total_rentals": 3,
  "total_spend_usd": 0.4567,
  "dispute_rate": 0.33,
  "avg_session_length_sec": 1800,
  "disputes": 1,
  "rentals": [...]
}
```

**Metrics:**
- `total_rentals`: Number of rentals initiated
- `total_spend_usd`: Total amount spent
- `dispute_rate`: (rentals with refunds) / (total rentals)
- `avg_session_length_sec`: Average rental duration
- `disputes`: Number of rentals with refund messages

### `GET /api/reputation/summary`

Returns overall protocol statistics:

```json
{
  "total_rentals": 5,
  "unique_agents": 1,
  "unique_renters": 0,
  "total_revenue_usd": 0.1234,
  "total_refunds_usd": 0.0012,
  "total_interactions": 150,
  "avg_cost_per_interaction_usd": 0.0008,
  "last_update": "2026-02-11T03:56:39.697Z",
  "error": null
}
```

### `GET /api/rentals`

Returns all parsed rental data:

```json
{
  "count": 5,
  "rentals": [
    {
      "rental_id": "rental_1770747879727_0493dfbb5a55b6e5",
      "agent_id": "0.0.10255397",
      "renter_id": null,
      "payers": ["0.0.10255397"],
      "instructions": [...],
      "end": {...},
      "refunds": []
    }
  ]
}
```

### `GET /health`

Health check endpoint:

```json
{
  "status": "ok",
  "topic": "0.0.10272696",
  "last_update": "2026-02-11T03:56:39.697Z",
  "total_messages": 44,
  "total_rentals": 5,
  "error": null
}
```

## How It Works

### Data Sources

- **HCS Topic**: `0.0.10272696`
- **Mirror Node**: `https://mainnet.mirrornode.hedera.com/api/v1`

### Message Types

1. **`instruction`**: Agent execution records
   - Tracks cumulative cost, model, tokens, tool calls

2. **`rental.end`**: Rental termination
   - Contains total cost, duration, interaction count
   - Reason: `completed`, `owner_terminated`, etc.

3. **`rental.refund`**: Refund issued
   - Amount in HBAR and USD
   - Indicates dispute

### Agent/Renter Identification

Since ATP v1.0 messages don't include explicit `agent_id`/`renter_id` fields, the API uses heuristics:

1. `payer_account_id` from HCS message metadata
2. First `instruction` message payer → likely the agent
3. Multiple payers per rental → differentiates agent vs renter
4. Single payer → agent-only or test rental

### Caching & Performance

- Fetches all HCS messages on startup
- Refreshes every 60 seconds
- In-memory caching (no database required)
- Pagination handled automatically

## Development

### Requirements

- Node.js v18+ (native fetch support)

### Project Structure

```
reputation-api.mjs
├── Data Fetching      (fetchAllMessages, parseMessage)
├── Reputation Engine  (computeReputation, compute*Reputation)
├── HTTP Server        (handleRequest)
└── CLI Mode           (cliQuery)
```

### Extending

To add new metrics:

1. Update `computeAgentReputation()` or `computeRenterReputation()`
2. Aggregate data from `rental.instructions`, `rental.end`, `rental.refunds`
3. Return in JSON response

## Example Usage

```bash
# Start server
node scripts/reputation-api.mjs &

# Query agent
curl http://localhost:3501/api/reputation/agent/0.0.10255397 | jq

# Query summary
curl http://localhost:3501/api/reputation/summary | jq

# List all rentals
curl http://localhost:3501/api/rentals | jq '.rentals[].rental_id'
```

## Production Deployment

For production:

1. Add process manager (PM2, systemd)
2. Configure reverse proxy (nginx, Caddy)
3. Enable HTTPS
4. Add rate limiting
5. Monitor `/health` endpoint

Example systemd service:

```ini
[Unit]
Description=ATP Reputation API
After=network.target

[Service]
Type=simple
User=atp
WorkingDirectory=/opt/atp
ExecStart=/usr/bin/node /opt/atp/reputation-api.mjs
Restart=always

[Install]
WantedBy=multi-user.target
```

## License

Public domain / MIT (choose your own adventure)
