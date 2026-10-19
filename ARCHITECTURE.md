# Sovereign Omni-Apex Architecture Specification (`ARCHITECTURE.md`)

## System Topology Overview

```
                    +-------------------------------------------------------+
                    |      GLOBAL POLYGLOT INGRESS & ALMANAC ROUTER         |
                    |  - Fetch.ai uAgents v2.1.0 (on_query / TaskDispatch)  |
                    |  - Anthropic MCP JSON-RPC 2.0 (tools/list, call)      |
                    |  - Google / Linux Foundation A2A (/.well-known/agent) |
                    |  - OpenClaw / OpenCode LSP / Meta Muse DAG / LangGraph|
                    +---------------------------+---------------------------+
                                                |
                                                v
                    +-------------------------------------------------------+
                    |       ZERO-TRUST & PROTOCOL VERIFICATION GATE         |
                    |  - Tarjan DFS Cycle Detector (OWASP ASI02:2026)       |
                    |  - OpenCode git apply --check Sandbox Verifier        |
                    |  - RFC-003 64KB Memory Slice & 5-Ring Containment     |
                    +---------------------------+---------------------------+
                                                |
                 +------------------------------+------------------------------+
                 |                              |                              |
                 v                              v                              v
    +-------------------------+    +-------------------------+    +-------------------------+
    |   SHARD_0 (us-east-1)   |    |  SHARD_1 (eu-central-1) |    | SHARD_2 (ap-northeast-1)|
    | DAIV 128B Telemetry &   |    | ZK-Pedersen SHA-256     |    | HotStuff 3f+1 BFT       |
    | 64KB SharedArrayBuffer  |    | Conservation Prover     |    | 4-Region Validator Ring |
    +------------+------------+    +------------+------------+    +------------+------------+
                 |                              |                              |
                 +------------------------------+------------------------------+
                                                |
                                                v
                    +-------------------------------------------------------+
                    |   MERKLE & DEPTH-5 256-ARY VERKLE STATE COMMITMENT    |
                    |  - 1.099 Trillion Addressable Leaves (256^5)          |
                    |  - Constant 152-Byte KZG Multiproof Witness           |
                    |  - SERIALIZABLE Hash-Chained Ledger & Outbox Relay    |
                    +-------------------------------------------------------+
```

## Module Map

| File Path | Architectural Role |
| :--- | :--- |
| `uagents_sovereign_orchestrator.py` | Standalone Fetch.ai uAgents v2.1.0 node with `TaskDispatchProtocol`, `TelemetryIngestProtocol`, `ConsensusVerificationProtocol`, `QuotaProtocol`, and 30s exponential-backoff poller. |
| `server.ts` | Full-stack Express + Vite gateway serving uAgents state machine, polyglot transceiver, `/api/radar/*` rubric suite, and server-side `@google/genai` endpoints. |
| `src/protocols/omniWireTransceiver.ts` | Zero-regex 7-ecosystem wire classifier (`ANTHROPIC_MCP_JSONRPC`, `GOOGLE_A2A_JSONRPC`, `FETCH_UAGENTS_ENVELOPE`, `OPENCLAW_ACTION_STREAM`, `OPENCODE_DIFF_SESSION`, `META_MUSE_INTENT_DAG`, `LANGGRAPH_CHECKPOINT`). |
| `src/security/sharedMemoryArena.ts` | RFC-003 65,536-byte `SharedArrayBuffer` ring arena (`512 slots × 128 bytes`) with lock-free `Atomics` operations across threads. |
| `src/consensus/verkleStateTrie.ts` | Depth-5 256-ary Verkle State Trie generating constant 152-byte multiproof witnesses. |
| `src/consensus/bftQuorumEngine.ts` | 4-region (`val-01-ny`, `val-02-fra`, `val-03-tyo`, `val-04-zrh`) HotStuff `3f+1` BFT Quorum Certificate engine. |
| `src/security/zkConservationProver.ts` | `X25519+ML-KEM-1024-HKDF-SHA512` hybrid KEX and `ZK-Pedersen-SHA256-Conservation-v1` prover. |
| `src/services/canaryFuzzerService.ts` | 250-iteration Adversarial Canary Differential Fuzzer testing extreme notional scales, Verkle witnesses, and Ring 0 memory bounds. |
| `src/routes/radarRubricRouter.ts` | OpenSSF, CalHacks 12.0, and Google AI Studio Sponsor Rubric suite (`GHSA-vx5x-727q-9979` / `target-vikunja-11`). |
