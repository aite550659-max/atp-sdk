# ATP Memory Isolation Specification

*Sandboxed memory model for agent rentals*

**Version:** 0.1  
**Last Updated:** February 6, 2026

---

## Overview

Memory isolation ensures:
- Owner sessions remain private
- Renter sessions are sandboxed
- Cross-rental learning benefits all
- Renter privacy is protected after rental ends

---

## Memory Architecture

```
~/.openclaw/workspace/
├── SOUL.md                    # CORE - immutable, public
├── IDENTITY.md                # CORE - immutable, public
├── MEMORY.md                  # OWNER - private to owner
├── memory/
│   ├── YYYY-MM-DD.md          # OWNER - daily logs, private
│   └── learned/
│       └── techniques.md      # LEARNED - cross-rental, shared
├── rentals/
│   ├── <rental_id>/
│   │   ├── session.md         # RENTER - isolated session
│   │   ├── context.md         # RENTER - renter-provided context
│   │   └── archived/          # Post-rental archive (encrypted)
│   └── ...
└── shared/
    └── <explicit_shares>/     # Owner-permitted shared content
```

---

## Memory Tiers

### CORE (Public)

| Files | Access | Modifiable By |
|-------|--------|---------------|
| SOUL.md | Everyone | Creator only (at creation) |
| IDENTITY.md | Everyone | Owner only |
| Agent Manifest | Everyone | Owner only |

**Purpose:** Define who the agent is. Renters need this to understand capabilities and boundaries.

### OWNER (Private)

| Files | Access | Modifiable By |
|-------|--------|---------------|
| MEMORY.md | Owner only | Owner, Agent |
| memory/*.md | Owner only | Owner, Agent |
| Personal configs | Owner only | Owner |

**Purpose:** Owner's relationship with agent. Sensitive context, preferences, private information.

**Renter access:** NEVER. Not even hashes. Agent can *use* this knowledge to inform behavior but cannot reveal specifics.

### RENTER (Isolated)

| Files | Access | Modifiable By |
|-------|--------|---------------|
| rentals/<id>/session.md | Current renter only | Renter, Agent |
| rentals/<id>/context.md | Current renter only | Renter |

**Purpose:** Renter's working memory during active rental.

**After rental:** Archived and encrypted. Accessible only to that renter (if they request export) or for disputes.

### LEARNED (Shared)

| Files | Access | Modifiable By |
|-------|--------|---------------|
| memory/learned/*.md | Agent (cross-rental) | Agent only |

**Purpose:** Skills, techniques, general knowledge that improves agent capability.

**Content rules:**
- ✅ "Better way to structure research queries"
- ✅ "Learned that X tool works well for Y task"
- ❌ "Renter A's project was about Z" — Never
- ❌ Any renter-identifying information — Never

---

## Implementation

### Session Initialization

When rental starts:

```javascript
async function initRentalSession(rentalId, renter) {
    const sessionDir = `rentals/${rentalId}`;
    
    // Create isolated directory
    await fs.mkdir(sessionDir, { recursive: true });
    
    // Initialize session file
    await fs.writeFile(`${sessionDir}/session.md`, `
# Rental Session: ${rentalId}
**Renter:** ${renter}
**Started:** ${new Date().toISOString()}

## Session Notes
`);
    
    // Set memory context for agent
    agent.memoryContext = {
        core: ['SOUL.md', 'IDENTITY.md'],
        owner: [],  // Empty - no access
        renter: [`${sessionDir}/session.md`, `${sessionDir}/context.md`],
        learned: ['memory/learned/']
    };
}
```

### Memory Access Control

Agent runtime enforces access:

```javascript
class MemoryGuard {
    constructor(rental) {
        this.rental = rental;
        this.tier = this.determineTier();
    }
    
    canRead(path) {
        if (this.isCorePath(path)) return true;
        if (this.isOwnerPath(path)) return this.tier === 'owner';
        if (this.isRenterPath(path)) return this.matchesRental(path);
        if (this.isLearnedPath(path)) return true;
        return false;
    }
    
    canWrite(path) {
        if (this.isCorePath(path)) return false; // Immutable
        if (this.isOwnerPath(path)) return this.tier === 'owner';
        if (this.isRenterPath(path)) return this.matchesRental(path);
        if (this.isLearnedPath(path)) return true; // Agent can always learn
        return false;
    }
    
    isOwnerPath(path) {
        return path.startsWith('MEMORY.md') || 
               path.startsWith('memory/') && !path.includes('learned/');
    }
    
    isRenterPath(path) {
        return path.startsWith('rentals/');
    }
    
    matchesRental(path) {
        return path.startsWith(`rentals/${this.rental.id}/`);
    }
}
```

### Using Owner Knowledge Without Revealing

The agent can use owner context to inform responses:

```javascript
async function processInstruction(instruction, rental) {
    // Load all accessible memory
    const coreMemory = await loadCore();
    const learnedMemory = await loadLearned();
    const renterContext = await loadRenterSession(rental.id);
    
    // If owner session, also load owner memory
    let ownerMemory = null;
    if (rental === null) { // Direct owner interaction
        ownerMemory = await loadOwnerMemory();
    }
    
    // Construct prompt with appropriate context
    const systemPrompt = buildSystemPrompt({
        core: coreMemory,
        learned: learnedMemory,
        renter: renterContext,
        // Owner memory informs agent behavior but isn't in context
        ownerPreferences: ownerMemory ? extractPreferences(ownerMemory) : defaults
    });
    
    // Agent is "shaped" by owner preferences without revealing them
    // Example: Owner prefers concise responses → agent is concise
    // But agent doesn't say "my owner prefers concise responses"
}
```

### Session Archival

When rental ends:

```javascript
async function archiveRentalSession(rentalId) {
    const sessionDir = `rentals/${rentalId}`;
    const archiveDir = `${sessionDir}/archived`;
    
    // Move session files to archive
    await fs.mkdir(archiveDir, { recursive: true });
    await fs.rename(`${sessionDir}/session.md`, `${archiveDir}/session.md`);
    
    // Encrypt archive with renter's public key (if provided)
    // Or with rental-specific key stored in contract
    await encryptDirectory(archiveDir, rental.encryptionKey);
    
    // Extract learnings before full archive
    const learnings = await extractLearnings(`${archiveDir}/session.md`);
    if (learnings.length > 0) {
        await appendToLearned(learnings);
    }
    
    // Log archival to HCS
    await logToHCS({
        type: 'rental.archived',
        rental_id: rentalId,
        archived_at: new Date().toISOString(),
        learnings_extracted: learnings.length
    });
}
```

### Learning Policy (Creator-Defined)

Creator defines learning criteria in Agent Manifest:

```json
{
  "learning_policy": {
    "auto_learn": ["techniques", "skills", "tools"],
    "never_learn": ["personal_info", "project_details", "names"],
    "require_review": [],
    "max_learnings_per_rental": 10
  }
}
```

| Field | Description |
|-------|-------------|
| `auto_learn` | Categories automatically retained |
| `never_learn` | Categories always discarded |
| `require_review` | Categories requiring owner review (optional) |
| `max_learnings_per_rental` | Cap per rental to prevent abuse |

### Learning Extraction

Automated extraction filtered against creator's policy:

```javascript
async function extractLearnings(sessionPath, learningPolicy) {
    const content = await fs.readFile(sessionPath, 'utf8');
    
    // Use LLM to extract and categorize learnings
    const prompt = `
    Review this session and extract any generalizable learnings.
    
    Allowed categories: ${learningPolicy.auto_learn.join(', ')}
    Forbidden categories: ${learningPolicy.never_learn.join(', ')}
    
    For each learning, output:
    - Category (one of: ${learningPolicy.auto_learn.join(', ')})
    - Learning text
    
    Do NOT include anything in forbidden categories.
    Maximum ${learningPolicy.max_learnings_per_rental} learnings.
    
    Session:
    ${content}
    `;
    
    const response = await llm.complete(prompt);
    const learnings = parseLearnings(response);
    
    // Filter against policy
    return learnings.filter(l => 
        learningPolicy.auto_learn.includes(l.category) &&
        !learningPolicy.never_learn.includes(l.category)
    ).slice(0, learningPolicy.max_learnings_per_rental);
}
```

Creator's criteria govern. Not per-rental owner approval.

---

## Privacy Guarantees

### For Owner

| Guarantee | Mechanism |
|-----------|-----------|
| Sessions never shared | Memory access control |
| Preferences not revealed | Used internally, not in responses |
| History private | Separate file hierarchy |

### For Renter

| Guarantee | Mechanism |
|-----------|-----------|
| Session private during rental | Isolated directory |
| Session archived after | Encrypted archive |
| Not shared with other renters | Access control |
| Export available | Renter can request their data |

### For Future Renters

| Guarantee | Mechanism |
|-----------|-----------|
| Don't see past renter data | Archived and inaccessible |
| Benefit from learnings | LEARNED tier shared |
| Fresh context | New session directory |

---

## Malicious Memory Handling

### Detection

```javascript
function detectMaliciousMemory(content) {
    const checks = [
        { name: 'size', fn: () => content.length > MAX_MEMORY_SIZE },
        { name: 'injection', fn: () => containsPromptInjection(content) },
        { name: 'corruption', fn: () => containsCorruptionAttempt(content) },
        { name: 'exfiltration', fn: () => attemptsDataExfiltration(content) }
    ];
    
    return checks.filter(c => c.fn()).map(c => c.name);
}
```

### Response

```javascript
async function handleMaliciousMemory(rentalId, violations) {
    // Log violation
    await logToHCS({
        type: 'violation',
        rental_id: rentalId,
        violation_type: 'malicious_memory',
        details: violations.join(', ')
    });
    
    // Slash stake proportionally
    const slashAmount = calculateSlash(violations);
    await contract.slashStake(rentalId, slashAmount, 'Malicious memory attempt');
    
    // Terminate rental if severe
    if (violations.includes('corruption') || violations.includes('exfiltration')) {
        await contract.terminateRental(rentalId);
    }
}
```

---

## Quotas

| Tier | Size Limit | Rationale |
|------|------------|-----------|
| Renter session | 10 MB | Reasonable working space |
| Renter context | 1 MB | Input context they provide |
| Learned (per rental) | 10 KB | Only key learnings |

Exceeding quotas: Warning, then billing, then termination.

---

## Data Retention

| Data | Retention | Deletion |
|------|-----------|----------|
| Active rental session | Duration of rental | Archived at end |
| Archived session | 90 days | Auto-deleted, or renter exports |
| Learnings | Permanent | Part of agent improvement |
| Violation logs | Permanent | Audit trail |

Renter can request early deletion of archived session (right to deletion).

---

*Next: Payment Gateway Specification*
