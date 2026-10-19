import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initCryptoEngine,
  exportPrivateKeyPemForTest,
  signPayload,
  verifyPayloadSignature,
  encryptData,
  decryptData,
} from '../src/security/cryptoService.js';
import {
  deriveHybridPqcSessionKey,
  generateZkConservationProof,
  verifyZkConservationProof,
} from '../src/security/zkConservationProver.js';
import { attestStateTransitionBftQuorum } from '../src/consensus/bftQuorumEngine.js';
import { serializeDaivBinary } from '../src/security/daivSerializer.js';
import { containmentEngine } from '../src/security/rogueContainmentEngine.js';
import { cep3Evaluator } from '../src/evaluation/cep3FastEvaluator.js';
import { OmniWireTransceiver, detectDagCycle } from '../src/protocols/omniWireTransceiver.js';
import { LockFreeDaivSharedArena } from '../src/security/sharedMemoryArena.js';
import { PlanetaryVerkleStateTrie } from '../src/consensus/verkleStateTrie.js';
import { AdversarialCanaryFuzzer } from '../src/services/canaryFuzzerService.js';
import { UniversalEcosystemRouter } from '../src/consensus/universalEcosystemRouter.js';
import {
  commitTransactionalOutbox,
  markOutboxDispatched,
  sweepUndispatchedOutboxEvents,
} from '../src/services/dbService.js';

test('1. Ed25519 + ML-DSA-87 Signing, Cross-Restart KMS PEM Reload & AES-256-GCM Roundtrip', () => {
  initCryptoEngine();
  const exportedPem = exportPrivateKeyPemForTest();
  const payload = { batchId: 'stl_001', grossNotionalUsd: 125000000 };
  const proof = signPayload(payload);
  assert.equal(proof.algo, 'Ed25519+ML-DSA-87-Hybrid');

  // Re-initialize from PEM to simulate container restart / horizontal replica verification
  initCryptoEngine(exportedPem);
  assert.equal(verifyPayloadSignature(payload, proof.signature), true);

  const enc = encryptData(JSON.stringify(payload));
  const dec = JSON.parse(decryptData(enc));
  assert.deepEqual(dec, payload);
});

test('2. 128-Byte DAIV Cache-Line Binary Alignment & RFC-003 Memory Slice Check', () => {
  const buf = serializeDaivBinary({
    cycleId: 42,
    driftBps: 0,
    memorySliceBytes: 32768,
    swarmIqScaled: 240,
    cep3Score: 0.994,
    latencyUs: 140,
    containmentFlags: 0,
  });
  assert.equal(buf.byteLength, 128);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  assert.equal(dv.getUint32(0x64, false), 0); // 0 bps drift
  assert.equal(dv.getUint32(0x68, false), 32768); // <= 65536 bytes
});

test('3. Phase XIV 5-Ring Rogue Containment & CEP-3.0 Fenwick Ranker', () => {
  const nominal = containmentEngine.inspectExecutionBoundary('{"status":"ok"}', 0.02);
  assert.equal(nominal.allowed, true);

  const oversized = containmentEngine.inspectExecutionBoundary('x'.repeat(70000), 0.01);
  assert.equal(oversized.allowed, false);

  const cep3 = cep3Evaluator.evaluate(true, 45, 0.01);
  assert.equal(cep3.verified, true);
  assert.ok(cep3.pass4Score > 0.9);
});

test('4. Byzantine Fault-Tolerant (HotStuff 3f+1) Multi-Region Quorum Attestation', () => {
  const qc = attestStateTransitionBftQuorum({
    ledgerHash: '0x94f8a21c7e3b60d481a95c2e7f4b3019d8e2c6a4f1b703d9e5a2c8f4b1d7e3a9',
    route: '/api/v1/settlements/batch',
    grossNotionalUsd: 125000000,
  });
  assert.equal(qc.totalValidators, 4);
  assert.equal(qc.quorumThreshold, 3);
  assert.equal(qc.validSignatures, 4);
  assert.equal(qc.quorumReached, true);
});

test('5. X25519+ML-KEM-1024 Hybrid Session Key & Zero-Knowledge Conservation Prover', () => {
  const kex = deriveHybridPqcSessionKey('settlement-channel');
  assert.equal(kex.kexScheme, 'X25519+ML-KEM-1024-HKDF-SHA512');
  assert.equal(kex.derivedSessionKeyFingerprint.length, 32);

  const zkProof = generateZkConservationProof(125000000);
  assert.equal(zkProof.conservedSumVerified, true);
  assert.equal(verifyZkConservationProof(zkProof), true);
});

test('6. Polyglot Wire Transceiver: 7-Ecosystem Frame Classification & Native MCP/A2A Dispatch', async () => {
  assert.equal(
    OmniWireTransceiver.detectWireProtocol({ jsonrpc: '2.0', method: 'tools/call', id: 1 }),
    'ANTHROPIC_MCP_JSONRPC'
  );
  assert.equal(
    OmniWireTransceiver.detectWireProtocol({ jsonrpc: '2.0', method: 'tasks/send', id: 2 }),
    'GOOGLE_A2A_JSONRPC'
  );
  assert.equal(
    OmniWireTransceiver.detectWireProtocol({ sender: 'agent1q2w3e4r5t6y7u8i9o0p', proto_digest: 'sha256:123' }),
    'FETCH_UAGENTS_ENVELOPE'
  );
  assert.equal(
    OmniWireTransceiver.detectWireProtocol({ openclaw_version: '1.4.0', dom_snapshot_hash: '0xabc' }),
    'OPENCLAW_ACTION_STREAM'
  );
  assert.equal(
    OmniWireTransceiver.detectWireProtocol({ opencode_session: 'sess_99', unified_diff: '--- a/app.ts' }),
    'OPENCODE_DIFF_SESSION'
  );
  assert.equal(
    OmniWireTransceiver.detectWireProtocol({ muse_intent_id: 'muse_01', plan_dag: [] }),
    'META_MUSE_INTENT_DAG'
  );
  assert.equal(
    OmniWireTransceiver.detectWireProtocol({ thread_id: 'lg_88', checkpoint_ns: 'main' }),
    'LANGGRAPH_CHECKPOINT'
  );

  const uniResult = await UniversalEcosystemRouter.routeAndNormalize({
    platform: 'OPENCODE',
    originAgentId: 'opencode-cli-terminal-user-01',
    intentPayload: { task: 'Refactor consensus engine and verify LSP diagnostics', filesModified: 3 },
    declaredNotionalUsd: 50000000,
  });
  assert.equal(uniResult.success, true);
  assert.equal(uniResult.bftQuorum.quorumReached, true);
});

test('7. RFC-003 64KB SharedArrayBuffer Lock-Free Ring Arena & Atomics Zero-Copy Read', () => {
  const arena = new LockFreeDaivSharedArena();
  assert.equal(LockFreeDaivSharedArena.PAGE_SIZE_BYTES, 65536);
  assert.equal(LockFreeDaivSharedArena.TOTAL_SLOTS, 512);

  const writeRes = arena.writeDescriptorLockFree({
    cycleId: 77,
    driftBps: 0,
    memorySliceBytes: 16384,
    swarmIqScaled: 250,
    cep3Score: 0.998,
    latencyUs: 64,
    containmentFlags: 0,
  });

  assert.equal(writeRes.slotIndex, 0);
  assert.equal(writeRes.totalWrites, 1);

  const zeroCopySlice = arena.readSlotZeroCopy(0);
  assert.equal(zeroCopySlice.byteLength, 128);
  const dv = new DataView(zeroCopySlice.buffer, zeroCopySlice.byteOffset, zeroCopySlice.byteLength);
  assert.equal(dv.getUint32(0x60, false), 77);    // cycleId = 77
  assert.equal(dv.getUint32(0x68, false), 16384); // memorySliceBytes = 16384
});

test('8. Depth-5 256-Ary Verkle State Trie & Constant 152-Byte KZG Multiproof Witness', () => {
  const trie = new PlanetaryVerkleStateTrie();
  const witness = trie.insertAndProve('agent:did:nexus:dcb7f346c0caf740', '0x94f8a21c7e3b60d4');

  assert.equal(witness.trieDepth, 5);
  assert.equal(witness.branchingFactor, 256);
  assert.equal(witness.maxLeafAddressSpace, '1099511627776'); // 256^5 = 1.099T leaves
  assert.equal(witness.witnessByteLength, 152);
  assert.equal(witness.keyPathIndices.length, 5);
  assert.equal(witness.verified, true);

  // Tamper with 1 byte of the 152-byte witness and verify cryptographic rejection
  const tamperedBuf = Buffer.from(witness.compactWitnessBase64, 'base64');
  tamperedBuf[42] ^= 0xff;
  assert.equal(trie.verifyCompactWitness(tamperedBuf), false);
});

test('9. Adversarial Canary Differential Fuzzer (250 Iterations Across Extreme Scales)', () => {
  const report = AdversarialCanaryFuzzer.runDifferentialFuzzCampaign(250);
  assert.equal(report.iterationsExecuted, 250);
  assert.equal(report.invariantsHeld, true);
  assert.equal(report.zkConservationPassRate, 100);
  assert.equal(report.verkle152BytePassRate, 100);
  assert.equal(report.overflowsCaughtByRing0, 25);
});

test('10. Outbox Dispatch Lifecycle, Tarjan DAG Cycle Gate & Cross-Worker SharedArrayBuffer', async () => {
  // 1. Verify Tarjan cycle detector catches cyclic A2A/Muse graphs
  assert.equal(detectDagCycle([{ id: 'A', next: ['B'] }, { id: 'B', next: ['C'] }, { id: 'C', next: [] }]), false);
  assert.equal(detectDagCycle([{ id: 'A', next: ['B'] }, { id: 'B', next: ['A'] }]), true);

  // 2. Verify Outbox commit + sweep lifecycle
  const rec = await commitTransactionalOutbox({
    idempotencyKey: 'test_outbox_10',
    route: '/api/v1/execute',
    grossNotionalUsd: 185000000,
    payload: { shard: 'SHARD_0' },
  });
  await markOutboxDispatched(rec.id);
  const sweptCount = await sweepUndispatchedOutboxEvents(async () => {});
  assert.equal(sweptCount, 0);

  // 3. Verify cross-thread SharedArrayBuffer attachment
  const primaryArena = new LockFreeDaivSharedArena();
  const { dataSab, controlSab } = primaryArena.getSharedBuffers();
  const workerAttachedArena = new LockFreeDaivSharedArena(dataSab, controlSab);

  primaryArena.writeDescriptorLockFree({
    cycleId: 999,
    driftBps: 0,
    memorySliceBytes: 8192,
    swarmIqScaled: 255,
    cep3Score: 0.999,
    latencyUs: 42,
    containmentFlags: 0,
  });

  assert.equal(workerAttachedArena.getArenaTelemetry().totalAtomicWrites, 1);
});
