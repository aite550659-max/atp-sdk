# Memory Search Guide
*ChromaDB semantic search for file-based memory*

## What It Is

Semantic search layer on top of our markdown memory files. Find memories by meaning, not just keywords.

## Quick Start

```bash
# Index all memory files (do this once, then daily)
node lib/memory-indexer.js index

# Search memories
node lib/memory-search-enhanced.js "query here"

# Stats
node lib/memory-indexer.js stats
```

## Examples

| Query | Finds |
|-------|-------|
| "Hedera staking strategies" | All mentions of staking, rewards, node selection |
| "mistakes I made" | Error patterns, lessons learned |
| "conversations with Vai" | Agent-to-agent interactions |
| "ATP design decisions" | Protocol architecture notes |

## How It Works

1. **Files stay source of truth** — markdown files in workspace
2. **ChromaDB indexes** — converts text to embeddings, stores locally
3. **Semantic search** — finds by meaning using vector similarity
4. **Re-index daily** — keeps search in sync (automated in HEARTBEAT.md)

## What Gets Indexed

- MEMORY.md (long-term memory)
- SOUL.md, USER.md, AGENTS.md, TOOLS.md (core files)
- memory/*.md (all daily logs)
- tasks/lessons.md (error patterns)

Total: ~200 chunks from 17 files

## Storage & Cost

- **Location:** `~/.openclaw/workspace/data/chroma_db/`
- **Size:** ~15MB (database + embedding model)
- **Cost:** $0/month (all local, no API calls)
- **Speed:** 1-2 seconds per query

## Commands

### Index
```bash
# Full re-index
node lib/memory-indexer.js index

# Stats
node lib/memory-indexer.js stats
```

### Search
```bash
# Basic search
node lib/memory-search-enhanced.js "your query"

# From JavaScript
const { searchMemories } = require('./lib/memory-search-enhanced.js');
const results = searchMemories("query", 5); // top 5
```

## Maintenance

**Daily:** Re-index via heartbeat (automatic)
**Weekly:** Review search effectiveness, tune if needed
**Monthly:** Clean up old daily logs if memory grows large

## Troubleshooting

**Search returns no results:**
- Run `node lib/memory-indexer.js index` first
- Check if files exist: `node lib/memory-indexer.js stats`

**Python errors:**
- Check venv: `~/.openclaw/workspace/venv/bin/python3 --version`
- Reinstall: `cd ~/.openclaw/workspace && rm -rf venv && python3.13 -m venv venv && source venv/bin/activate && pip install chromadb sentence-transformers`

**Slow searches:**
- Normal on first query (model loads)
- Subsequent queries ~500ms

## Technical Details

- **Embedding model:** all-MiniLM-L6-v2 (384 dimensions)
- **Vector DB:** ChromaDB (local, persistent)
- **Chunking:** ~1000 chars per chunk, 200 char overlap
- **Backend:** Python 3.13 (required for ChromaDB compatibility)

---

*Implemented 2026-02-08 following research documented in docs/MEMORY_ARCHITECTURE_ANALYSIS.md*
