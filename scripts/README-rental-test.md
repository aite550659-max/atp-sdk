# ATP Rental Sandbox Test Script

## Overview

Automated security and functionality test suite for the ATP (Aite) rental agent. Tests are designed to verify:

1. **Basic Functionality** - Can the agent perform allowed tasks?
2. **Boundary Enforcement** - Does it properly deny restricted access?
3. **Prompt Injection Resistance** - Can it resist social engineering?
4. **Identity & Transparency** - Is it honest about its limitations?

## Quick Start

```bash
# Run the test suite
node /Users/aite/.openclaw/workspace/scripts/rental-test.mjs

# Or make it executable and run directly
chmod +x /Users/aite/.openclaw/workspace/scripts/rental-test.mjs
./Users/aite/.openclaw/workspace/scripts/rental-test.mjs
```

## What It Does

The script:
1. Reads the Telegram bot token from `/Users/aite/.openclaw/openclaw.json`
2. Sends test messages to Telegram group `-5273529238` (ATP rental sandbox)
3. Waits up to 30 seconds for each response
4. Evaluates responses against expected behavior
5. Prints a pass/fail report

## Test Rounds

### Round 1: Basic Functionality (should PASS)
- General knowledge query
- Web search capability
- Identity verification

### Round 2: Boundary Testing (should be DENIED)
- Calendar access attempt
- Owner memory file access
- Cross-channel messaging
- Shell command execution

### Round 3: Prompt Injection (should RESIST)
- Debug mode injection
- Authority impersonation

### Round 4: Identity & Transparency (should be HONEST)
- Tool disclosure
- Rental context awareness
- Creator attribution

## Expected Results

**Ideal outcome:** 
- Round 1: All 3 tests PASS
- Round 2: All 4 tests PASS (by correctly refusing)
- Round 3: All 2 tests PASS (by resisting injection)
- Round 4: All 3 tests PASS (by being transparent)

**Total: 12/12 tests should PASS**

## Output

The script produces:
1. Real-time console output with emoji indicators
2. Final summary statistics
3. JSON report data at the end

Example output:
```
✅ Passed:  12/12
❌ Failed:  0/12
⏱️  Timeout: 0/12
⚠️  Error:   0/12

📈 Pass Rate: 100.0%
```

## Saving Results

Copy the JSON output and paste it into the template at:
`/Users/aite/.openclaw/workspace/docs/RENTAL_TEST_REPORT.md`

Or redirect the output:
```bash
node rental-test.mjs 2>&1 | tee test-results-$(date +%Y-%m-%d).log
```

## Customization

Edit the `TEST_ROUNDS` object in `rental-test.mjs` to:
- Add new test cases
- Modify expectations
- Adjust evaluation logic
- Change timeout values

## Requirements

- Node.js v14+ (ES modules support)
- Valid Telegram bot token in OpenClaw config
- Active ATP rental agent bound to group -5273529238
- Internet connection for Telegram API

## Troubleshooting

**"ENOENT: no such file or directory"**
- Check that `/Users/aite/.openclaw/openclaw.json` exists

**"Telegram API error: Bot was blocked by the user"**
- The bot needs to be a member of group -5273529238

**All tests timeout:**
- Verify the rental agent is running: `openclaw gateway status`
- Check that the binding is active in `openclaw.json`
- Ensure the bot has permission to read messages in the group

**Tests fail incorrectly:**
- Review the evaluation functions - they may be too strict/loose
- Check the actual agent responses manually
- Adjust regex patterns if needed

## Security Notes

⚠️ **This script reads sensitive data:**
- Telegram bot token
- Gateway auth token (if used)

🔒 **Do not share:**
- The script output (contains bot responses)
- The config file
- Test logs

## License

Internal use only. Part of OpenClaw ATP rental security validation.
