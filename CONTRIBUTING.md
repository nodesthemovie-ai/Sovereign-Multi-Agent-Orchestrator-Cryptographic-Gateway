# Contributing to REA Sovereign Omni-Apex Orchestrator (`CONTRIBUTING.md`)

## Deterministic Verification Workflow

Every pull request must pass all 10 architectural and cryptographic pillar tests before merge:

```bash
# 1. Install dependencies
npm install

# 2. Run the 10-Pillar Consensus & Cryptographic Test Suite
npm test

# 3. Verify GHSA-vx5x-727q-9979 Remediation Patch PoC
bash verification.poc.sh

# 4. Verify TypeScript & Vite Production Bundle Compilation
npm run build
```

## Coding & Architectural Invariants

1. **Server-Side `@google/genai` Only**: All Gemini API calls (`gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-3.8-flash-tts`, `gemini-3-pro-image-preview`) must remain strictly server-side with `User-Agent: aistudio-build`.
2. **RFC-003 Memory Ceiling**: Per-invocation state slices must not exceed `65,536 bytes` (1 Wasm page).
3. **Zero-Drift Conservation**: Every settlement mutation must generate a valid `ZK-Pedersen-SHA256-Conservation-v1` proof and `HotStuff-BFT-3f+1` Quorum Certificate.
