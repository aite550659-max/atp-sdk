# Contributing to ATP

## Code of Conduct

Build with integrity. Review with respect. Ship with care.

## How to Contribute

We welcome contributions in any form:

- **Issues** — Report bugs, request features, ask questions
- **Pull Requests** — Fix bugs, add features, improve docs
- **Documentation** — Fix typos, clarify explanations, add examples
- **Testing** — Write tests, report edge cases, validate on testnet
- **Reviews** — Review PRs, suggest improvements, catch bugs

## What We're Looking For

**High-priority areas:**

1. **Indexer improvements** — Performance optimization, query efficiency, caching strategies
2. **SDK bindings** — Python, Go, Rust, or other language implementations
3. **Test coverage** — Integration tests, edge cases, failure modes
4. **Documentation** — Tutorials, guides, API examples, architecture explanations
5. **Security review** — Audit HCS message schemas, rental constraints, dispute logic

## Getting Started

1. Fork the repo
2. Create a branch (`git checkout -b feature/my-contribution`)
3. Make your changes
4. Test locally (run `npm test`)
5. Commit with clear messages
6. Push and open a PR

**PR guidelines:**
- Keep changes focused (one feature/fix per PR)
- Write clear commit messages
- Add tests for new functionality
- Update docs if you change behavior

## Contribution Tracking

Every merged PR and significant issue is logged to Hedera's HCS audit trail (topic [0.0.10261370](https://hashscan.io/mainnet/topic/0.0.10261370)). This creates a **permanent, public, verifiable record** of your contribution.

Your work becomes part of the immutable history of ATP. No centralized database. No takebacks. Just consensus timestamps and cryptographic proof.

---

Contribute because you believe in verifiable AI agents. We track every contribution on-chain because we believe in recognition. The rest will follow.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/aite550659-max/atp-sdk.git
cd atp-sdk

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run on testnet
npm run test:integration
```

## Questions?

- Open an issue
- Check existing docs in `/docs`
- Read the spec (coming soon)

## License

By contributing, you agree that your contributions will be licensed under Apache 2.0.

---

**Remember:** This is alpha software. Expect rough edges. Your contributions will make it better.
