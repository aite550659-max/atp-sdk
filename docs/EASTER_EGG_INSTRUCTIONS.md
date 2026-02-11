# Easter Egg Hunt - Management Instructions

## 🎯 Hunt Overview

**Prize:** 55 HBAR (~$5) to first 10 valid submissions  
**Total Cost:** 550 HBAR (~$50)  
**Passphrase:** TRUST-VERIFY-HEDERA

## 🗺️ Clue Locations

### Clue 1: X Thread (Tweet 4/7)
The tweet mentions "v1.0 schema"  
**Hidden word:** TRUST (explicitly mentioned in tweet 5: "Trust but Verify")

### Clue 2: GitHub README.md
HTML comment in Features section (line ~77):  
`<!-- Easter egg hunters: The second word is VERIFY -->`  
**Hidden word:** VERIFY

### Clue 3: HCS Viewer (viewer/hcs-viewer.html)
CSS comment at top of style section (line ~7):  
`/* Easter egg hunters: The third word is HEDERA */`  
**Hidden word:** HEDERA

## ✅ Valid Submission Format

Participants should reply to tweet 7/7 with:
```
🔐 TRUST-VERIFY-HEDERA
Account: 0.0.XXXXXXX
```

## 📋 Verification Process

1. **Monitor replies** to the final tweet (7/7) in the thread
2. **Check format:**
   - Correct passphrase: TRUST-VERIFY-HEDERA
   - Valid Hedera account ID format: 0.0.XXXXXXX
3. **Track winners:**
   - First 10 valid submissions only
   - One prize per account (honor system)
4. **Send rewards:**
   - Transfer 55 HBAR to each valid address
   - Log each payment to HCS Topic 0.0.10261370

## 💸 Payment Command

For each winner:
```bash
node ~/.openclaw/workspace/hedera_send_test.js \
  --to 0.0.XXXXXXX \
  --amount 55 \
  --memo "Easter egg hunt prize - hcs-agent-logger"
```

Or use the Hashpack wallet UI for manual transfers.

## 📊 HCS Logging

After sending each payment, log it:
```bash
~/.openclaw/workspace/bin/hcs-log transaction \
  "HBAR_TRANSFER" \
  "0.0.XXXXXXX@$(date +%s).000000" \
  "55 HBAR easter egg prize to winner #N" \
  "Community engagement reward"
```

## 🔒 Anti-Gaming Measures

- **Manual review** - Gregg verifies each submission before sending
- **One per account** - Honor system, but check for duplicate addresses
- **Public transparency** - All payments logged on HCS for community verification
- **Time limit** - Consider closing after 24-48 hours if slow uptake

## 📈 Expected Outcomes

- **Engagement:** Drives GitHub stars, repo exploration
- **Community:** Demonstrates HCS + HBAR transfers in action
- **Marketing:** Each winner becomes an advocate
- **Trust:** Public audit trail of all prizes sent

## 🚨 Troubleshooting

**Too many valid submissions:**
- Stick to first 10 (timestamp order)
- Post update tweet: "Hunt closed! Winners announced soon"

**No/few submissions:**
- Drop additional hints after 24h
- Extend to first 20 winners

**Invalid submissions:**
- Reply with hint: "Close! Check the clue locations again"

## 📁 Files

- **Solution (private):** `/Users/aite/.openclaw/workspace/repos/hcs-agent-logger/EASTER_EGG_SOLUTION.md`
- **Thread with hunt:** `/Users/aite/.openclaw/workspace/drafts/hcs-audit-thread-with-hunt.txt`
- **This doc:** `/Users/aite/.openclaw/workspace/docs/EASTER_EGG_INSTRUCTIONS.md`

---

**Ready to launch!** Post the updated X thread and monitor for submissions. 🎁⚡
