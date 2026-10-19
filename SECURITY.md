# Security Policy & Cryptographic Architecture (`SECURITY.md`)

## Supported Versions

| Version | Codename | Supported | Cryptographic Enclave |
| :--- | :--- | :--- | :--- |
| `7.0.0-omni-apex` | **Omni-Apex** | ✅ Active | `Ed25519+ML-DSA-87` / `X25519+ML-KEM-1024` / `ZK-Pedersen` / `Verkle-152B` |
| `6.0.0-singularity` | **Singularity** | ✅ Maintenance | `Ed25519+ML-DSA-87` / `X25519+ML-KEM-1024` / `ZK-Pedersen` |

---

## Core Zero-Trust & Post-Quantum Guarantees

1. **Zero-Trust SPIFFE/SVID mTLS**:
   - Enforces mutual TLS peer verification via `x-forwarded-client-cert` and `x-spiffe-id === EXPECTED_SPIFFE_ID` when `ENFORCE_MTLS=true`.
2. **Post-Quantum Hybrid Cryptography**:
   - **Signing**: `Ed25519+ML-DSA-87-Hybrid` deterministic signatures over canonical JSON representations with cross-replica KMS PEM reload support.
   - **Key Exchange**: `X25519+ML-KEM-1024-HKDF-SHA512` (RFC 5869) forward-secret session derivation.
   - **Zero-Knowledge Conservation Proofs**: `ZK-Pedersen-SHA256-Conservation-v1` proving `grossInput === netOutput + protocolFee` without cleartext counterparty leakage.
3. **RFC-003 64KB Memory Slice Boundary & 5-Ring Rogue Containment**:
   - Payloads exceeding `65,536 bytes` (1 Wasm memory page) or exhibiting constitutional drift $\Delta > 0.15$ immediately trip Ring 0/1/2 containment flags (`src/security/rogueContainmentEngine.ts`).
4. **OWASP ASI02:2026 Tarjan DAG Cycle Prevention**:
   - All inbound multi-agent intent graphs (`META_MUSE_INTENT_DAG` / A2A) are inspected by `detectDagCycle()` prior to execution to prevent infinite recursive delegation loops.

## Reporting a Vulnerability

Please report suspected cryptographic or protocol vulnerabilities via private GitHub Security Advisories (`GHSA`). All verified patches are validated in an isolated sandbox via `git apply --check` and attested with SLSA v1.0 build provenance.
