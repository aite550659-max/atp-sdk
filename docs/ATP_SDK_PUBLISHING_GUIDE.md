# ATP SDK Publishing Guide

**Status:** Ready for review  
**Current Version:** 0.1.0 (unpublished)  
**Target Package Name:** `@agent-trust-protocol/sdk`

---

## What SDK Publishing Means

Publishing the ATP SDK makes it publicly available on npm so developers can:

```bash
npm install @agent-trust-protocol/sdk
```

Then use it in their projects:

```typescript
import { ATPClient } from '@agent-trust-protocol/sdk';
```

---

## Current Status: ~80% Ready

### ✅ What's Done

1. **package.json** - Complete with metadata, scripts, dependencies
2. **README.md** - Comprehensive with examples, architecture, links
3. **TypeScript build** - Works (`npm run build` generates `dist/`)
4. **Unit tests** - 10+ passing tests
5. **Source code** - Complete and functional
6. **Exchange rate service** - Integrated and tested

### ❌ What's Missing

#### 1. LICENSE File (5 minutes)
**Current:** Not present  
**Need:** LICENSE file in root directory

**Options:**
- **Apache-2.0** (already declared in package.json, permissive)
- **MIT** (more permissive, simpler)
- **Dual license** (Apache-2.0 + MIT for flexibility)

**Action:** Create `LICENSE` file with chosen license text

---

#### 2. .npmignore File (2 minutes)
**Purpose:** Exclude files from published package (reduces package size)

**Typical exclusions:**
```
# Source files (only ship compiled dist/)
src/
tsconfig.json

# Tests
__tests__/
__mocks__/
test/
*.test.ts
examples/
test-exchange-rate.ts

# Build artifacts
*.log
*.tsbuildinfo

# Development files
.git/
.github/
.vscode/
.DS_Store
node_modules/
coverage/

# Docs (keep or remove based on preference)
docs/
*.md (except README.md)
```

**Result:** Package goes from ~5MB to ~500KB

---

#### 3. GitHub Repository (30 minutes)
**Current:** `package.json` points to non-existent repo  
**Declared:** `https://github.com/hashgraph/atp-sdk.git`

**Options:**

**A. Official Hedera Org (Recommended)**
- URL: `github.com/hashgraph/atp-sdk`
- Pros: Official backing, credibility, searchability
- Cons: Requires approval from Hedera Foundation
- Timeline: 1-2 weeks (if you have connections)

**B. Your Personal Org**
- URL: `github.com/greggbell/atp-sdk`
- Pros: Immediate control, easy setup
- Cons: Less discoverable, no official stamp
- Timeline: 5 minutes

**C. New ATP Org**
- URL: `github.com/agent-trust-protocol/atp-sdk`
- Pros: Professional, dedicated org
- Cons: Requires creating/managing new org
- Timeline: 10 minutes

**Action Required:**
1. Create GitHub repo (public)
2. Push code: `git init`, `git remote add origin`, `git push`
3. Update `package.json` repository URL
4. Add GitHub badges to README

---

#### 4. npm Account & Organization (10 minutes)

**Personal Publishing:**
```bash
npm login
npm publish --access public
```

**Organization Publishing (`@agent-trust-protocol/sdk`):**
Requires either:
- Access to `@hashgraph` npm org (probably doesn't exist or you don't have access)
- Create your own org: `npm org create agent-trust-protocol`
- Use personal scope: `@greggbell/atp-sdk`

**Recommendation:** Start with personal scope (`@greggbell/atp-sdk`), transfer to org later

---

#### 5. Pre-Publishing Checklist (15 minutes)

**Code Quality:**
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No sensitive data in repo (API keys, private keys)
- [ ] Dependencies are production-ready (no dev-only packages in deps)

**Documentation:**
- [ ] README has install instructions
- [ ] Examples work and are up-to-date
- [ ] Breaking changes noted (for version bumps)
- [ ] CHANGELOG.md created (optional for v0.1.0)

**Legal:**
- [ ] LICENSE file present
- [ ] Copyright notices in place
- [ ] Third-party attributions (if using others' code)

**Package Metadata:**
- [ ] Version correct (0.1.0 = first alpha)
- [ ] Keywords relevant (atp, hedera, agents, hcs)
- [ ] Description clear and searchable
- [ ] Author/contributors listed

---

## Publishing Process (Step-by-Step)

### Step 1: Prepare Repository

```bash
cd ~/atp-sdk

# Create LICENSE file
cat > LICENSE << 'EOF'
Apache License 2.0
[full license text]
EOF

# Create .npmignore
cat > .npmignore << 'EOF'
src/
__tests__/
examples/
test-exchange-rate.ts
tsconfig.json
*.log
.git/
EOF

# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit - ATP SDK v0.1.0"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_ORG/atp-sdk.git
git branch -M main
git push -u origin main
```

---

### Step 2: Test Locally

```bash
# Build and verify package contents
npm run build
npm pack

# This creates @hashgraph-atp-sdk-0.1.0.tgz
# Extract and inspect:
tar -tzf hashgraph-atp-sdk-0.1.0.tgz | head -20

# Test install in another project
cd /tmp/test-project
npm init -y
npm install ~/atp-sdk/hashgraph-atp-sdk-0.1.0.tgz

# Verify imports work
node -e "const { ATPClient } = require('@agent-trust-protocol/sdk'); console.log(ATPClient);"
```

---

### Step 3: Publish to npm

```bash
cd ~/atp-sdk

# Login to npm (one-time)
npm login

# Dry run (shows what will be published)
npm publish --dry-run

# Publish (for real)
npm publish --access public

# Output:
# + @agent-trust-protocol/sdk@0.1.0
```

---

### Step 4: Verify Publication

```bash
# Check on npm registry
open https://www.npmjs.com/package/@agent-trust-protocol/sdk

# Install in clean project
cd /tmp/new-test
npm init -y
npm install @agent-trust-protocol/sdk

# Test import
node -e "const { ATPClient } = require('@agent-trust-protocol/sdk'); console.log('✅ Works!');"
```

---

## Post-Publishing Tasks

### 1. Add Badges to README

```markdown
[![npm version](https://badge.fury.io/js/@hashgraph%2Fatp-sdk.svg)](https://www.npmjs.com/package/@agent-trust-protocol/sdk)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Build Status](https://github.com/hashgraph/atp-sdk/workflows/CI/badge.svg)](https://github.com/hashgraph/atp-sdk/actions)
```

### 2. Set Up CI/CD (GitHub Actions)

**File:** `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test
      - run: npm run build
```

### 3. Create Release on GitHub

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then create GitHub Release with:
- Tag: v0.1.0
- Title: "ATP SDK v0.1.0 - Initial Alpha Release"
- Body: Changelog, breaking changes, highlights

### 4. Announce

- [ ] Post on Hedera Discord
- [ ] Tweet from @GregoryLBell
- [ ] Share on LinkedIn
- [ ] Add to Hedera ecosystem page

---

## Version Management Strategy

**Semantic Versioning (semver):** `MAJOR.MINOR.PATCH`

**Current:** 0.1.0 (alpha)

**Future versions:**
- **0.1.1** - Patch (bug fixes)
- **0.2.0** - Minor (new features, backward compatible)
- **1.0.0** - Major (production-ready, stable API)

**Publishing updates:**
```bash
# Bump version
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.0 → 0.2.0
npm version major  # 0.1.0 → 1.0.0

# Publish
npm publish
```

---

## Package Scope Decision

**Current package name:** `@agent-trust-protocol/sdk`

**Issues:**
- `@hashgraph` scope might not be yours
- Publishing will fail if org doesn't exist or you lack access

**Options:**

| Scope | Name | Pros | Cons |
|-------|------|------|------|
| **@hashgraph** | @agent-trust-protocol/sdk | Official feel, discoverable | May not have access |
| **@greggbell** | @greggbell/atp-sdk | Immediate control | Personal branding |
| **@atp** | @atp/sdk | Short, clean | Org name might be taken |
| **@agent-trust-protocol** | @agent-trust-protocol/sdk | Professional, dedicated | Longer name |
| **No scope** | atp-sdk | Simple | Less namespace control |

**Recommended Flow:**
1. Start: `@greggbell/atp-sdk` (immediate)
2. Later: Transfer to `@agent-trust-protocol/sdk` or `@agent-trust-protocol/sdk`
3. Use `npm deprecate` to redirect old package

---

## Cost & Considerations

**npm Registry:**
- **Free** for open-source packages
- Unlimited downloads
- 10GB bandwidth/week (more than enough)

**GitHub:**
- **Free** for public repos
- Actions: 2,000 minutes/month free

**Maintenance:**
- **Ongoing:** Respond to issues, merge PRs, publish updates
- **Time:** 1-2 hours/week initially

**Risks:**
- **Breaking changes:** Semver protects users if you follow it
- **Security:** npm supply chain attacks (use 2FA, trusted CI)
- **Abandonment:** Clearly mark alpha/beta status

---

## Decision Points for Gregg

### 1. License Choice
- [ ] Apache-2.0 (current in package.json)
- [ ] MIT (simpler, more permissive)
- [ ] Other? (BSD, GPL, etc.)

### 2. Repository Location
- [ ] Option A: `github.com/hashgraph/atp-sdk` (requires permission)
- [ ] Option B: `github.com/greggbell/atp-sdk` (immediate)
- [ ] Option C: New org `github.com/agent-trust-protocol/atp-sdk`

### 3. npm Package Scope
- [ ] Option A: `@agent-trust-protocol/sdk` (may require access)
- [ ] Option B: `@greggbell/atp-sdk` (immediate control)
- [ ] Option C: `@agent-trust-protocol/atp-sdk` (create org)

### 4. Publish Timing
- [ ] Option A: Publish now (alpha warning)
- [ ] Option B: Wait for mainnet validation
- [ ] Option C: Wait for v1.0 (production-ready)

### 5. Public vs Private Beta
- [ ] Public npm (anyone can install)
- [ ] Private beta (invite-only, npm teams)
- [ ] GitHub only (no npm, manual install)

---

## Recommendation

**For right now (February 2026):**

1. **GitHub:** Create `github.com/greggbell/atp-sdk` (immediate)
2. **npm:** Publish `@greggbell/atp-sdk` (immediate control)
3. **License:** Apache-2.0 (matches declaration, enterprise-friendly)
4. **Status:** Mark as **alpha** prominently in README
5. **Timing:** Publish after mainnet validation (1-2 weeks)

**Why this path:**
- ✅ No delays waiting for permissions
- ✅ You control the release process
- ✅ Easy to transfer to official org later
- ✅ Developers can start testing immediately
- ✅ Establishes presence in npm ecosystem

**Later (6-12 months):**
- Transfer to `@agent-trust-protocol/sdk` or `@agent-trust-protocol/sdk`
- Use `npm deprecate @greggbell/atp-sdk` to redirect users
- Hedera Foundation might adopt officially

---

## Total Time Estimate

**Minimum (personal scope):** ~1 hour
- 5 min: Add LICENSE
- 2 min: Add .npmignore
- 10 min: Create GitHub repo + push
- 10 min: npm login + publish
- 5 min: Verify publication
- 30 min: Testing and documentation

**With org setup:** +2 hours
- Creating org, transferring, coordinating

**With Hedera approval process:** +1-2 weeks
- Discussions, permissions, reviews

---

## Next Steps

**What do you want to do?**

1. **Publish now** - I can do it in ~1 hour (need npm credentials)
2. **Prepare but don't publish** - Add LICENSE/.npmignore, create repo, test pack
3. **Decide on naming first** - Pick org/scope before any work
4. **Wait for mainnet** - Complete ATP testing first, publish after

Let me know your preference and I'll execute accordingly!
