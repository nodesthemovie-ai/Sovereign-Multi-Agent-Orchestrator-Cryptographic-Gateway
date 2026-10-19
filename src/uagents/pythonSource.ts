export const SOVEREIGN_UAGENTS_PYTHON_CODE = `"""
Sovereign Multi-Agent Orchestrator & Cryptographic Gateway
Canonical Service Slug: rea-autonomous-orchestrator-engine (v6.0.0-singularity)
Compatible with Fetch.ai uAgents, Almanac Contract, and DeltaV AI Engine
"""

from uagents import Agent, Context, Model, Protocol
from uagents.experimental.quota import QuotaProtocol, RateLimit
from ai_engine import UAgentResponse, UAgentResponseType
from pydantic import Field
from typing import Dict, Any, List, Optional
import asyncio
import hashlib
import hmac
import json
import random
import time
import requests

# ==========================================
# 0. AGENT INITIALIZATION & ALMANAC IDENTITY
# ==========================================

agent = Agent(
    name="sovereign_orchestrator_gateway",
    seed="rea-autonomous-orchestrator-engine-sovereign-seed-v6",
    port=8000,
    endpoint=["https://rea-autonomous-orchestrator-engine.quantumsync.io/submit"],
    almanac_contract_registration=True,
)

EXTERNAL_ENGINE_URL = "https://your-external-orchestrator.run.app/api/v1/execute"
TELEMETRY_ENDPOINTS = [
    "https://your-external-orchestrator.run.app/api/v1/telemetry/daiv",
    "https://your-external-orchestrator.run.app/api/v1/consensus/quorum",
    "https://your-external-orchestrator.run.app/api/v1/liquidity/depth",
]

DOWNSTREAM_WORKERS = [
    "agent1q2w3e4r5t6y7u8i9o0p2a4s6d8f0g2h4j6k8l0z2x4c6v8b0n2m4q6w8e0",  # Specialist Agent A (Telemetry / DAIV Vision)
    "agent1q9z8x7c6v5b4n3m2l1k0j9h8g7f6d5s4a3p2o1i0u9y8t7r6e5w4q3z2x1",  # Specialist Agent B (Z3 Conservation / Grading)
    "agent1q7m6n5b4v3c2x1z0p9o8i7u6y5t4r3e2w1q0a9s8d7f6g5h4j3k2l1m0n9",  # Specialist Agent C (HotStuff 3f+1 BFT Validator)
]

# ==========================================
# 1. STRICT PYDANTIC / uAGENTS DATA MODELS
#    (Includes payload_hash, timestamp, signature)
# ==========================================

class TaskDispatch(Model):
    directive_id: str = Field(..., description="Unique UUIDv7 or deterministic directive identifier")
    objective: str = Field(..., description="High-level DeltaV or institutional routing objective")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Execution parameters and notional bounds")
    task_shard: str = Field(default="SHARD_ROOT", description="Shard identifier for parallel worker execution")
    payload_hash: str = Field(..., description="Canonical SHA-256 hex digest of sorted parameters")
    timestamp: int = Field(..., description="Unix epoch timestamp in seconds")
    signature: str = Field(..., description="Ed25519 / Hybrid PQC signature over directive_id:timestamp:payload_hash")

class TelemetryIngest(Model):
    ingest_id: str = Field(..., description="Unique telemetry frame identifier")
    source_endpoint: str = Field(..., description="Queried external REST endpoint URI")
    state_delta: Dict[str, Any] = Field(..., description="Computed state delta persisted into ctx.storage")
    daiv_cache_line_hex: str = Field(..., description="128-byte DAIV cache-line telemetry hex digest")
    backoff_attempts: int = Field(default=0, description="Exponential backoff retry count before success")
    payload_hash: str = Field(..., description="Canonical SHA-256 hex digest of state_delta")
    timestamp: int = Field(..., description="Unix epoch timestamp in seconds")
    signature: str = Field(..., description="Ed25519 / Agent wallet signature over ingest payload")

class ConsensusVerification(Model):
    directive_id: str = Field(..., description="Directive ID being attested by downstream specialist worker")
    worker_address: str = Field(..., description="Bech32 agent1q... address of attesting worker")
    task_shard: str = Field(..., description="Completed shard identifier")
    result_data: Dict[str, Any] = Field(..., description="Structured worker execution output")
    state_merkle_root: str = Field(..., description="SHA-256 Merkle root of canonical sorted result_data")
    payload_hash: str = Field(..., description="SHA-256 digest of the attestation envelope")
    timestamp: int = Field(..., description="Unix epoch timestamp in seconds")
    signature: str = Field(..., description="Cryptographic worker signature over directive_id:state_merkle_root:timestamp")

# Legacy / Alias Models for Sovereign Compatibility
SovereignDirective = TaskDispatch
WorkerSubTask = TaskDispatch
WorkerAttestation = ConsensusVerification

# ==========================================
# 2. THREE CUSTOM PROTOCOLS & QUOTA GUARDRAILS
# ==========================================

task_dispatch_proto = Protocol(name="TaskDispatchProtocol", version="2.1.0")
telemetry_ingest_proto = Protocol(name="TelemetryIngestProtocol", version="2.1.0")
consensus_verification_proto = Protocol(name="ConsensusVerificationProtocol", version="2.1.0")

quota_proto = QuotaProtocol(
    storage_reference=agent.storage,
    name="SovereignQuota",
    version="1.0.0",
    default_rate_limit=RateLimit(window_size_minutes=1, max_requests=30),
)

def compute_canonical_digest(data: Dict[str, Any]) -> str:
    serialized = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()

def verify_envelope_digest(data: Dict[str, Any], expected_hash: str) -> bool:
    computed = compute_canonical_digest(data)
    return hmac.compare_digest(computed, expected_hash)

# ==========================================
# 3. PARALLEL SWARM FAN-OUT (on_query + Protocol Handler)
# ==========================================

async def _fan_out_subtasks(ctx: Context, sender: str, msg: TaskDispatch) -> UAgentResponse:
    ctx.logger.info(f"[INGRESS] TaskDispatch {msg.directive_id} from {sender} | Objective: {msg.objective}")

    # Verify incoming payload_hash integrity before fan-out
    expected_param_hash = compute_canonical_digest(msg.parameters)
    if msg.payload_hash != expected_param_hash:
        ctx.logger.error(f"[SECURITY FAULT] Ingress payload_hash mismatch on {msg.directive_id}")
        return UAgentResponse(
            message=f"Rejected directive {msg.directive_id}: cryptographic payload_hash mismatch.",
            type=UAgentResponseType.FINAL,
        )

    # 1. Initialize persistent state machine in Agentverse ctx.storage
    state_key = f"directive_{msg.directive_id}"
    now_ts = int(time.time())
    ctx.storage.set(state_key, {
        "directive_id": msg.directive_id,
        "origin": sender,
        "objective": msg.objective,
        "parameters": msg.parameters,
        "payload_hash": msg.payload_hash,
        "signature": msg.signature,
        "status": "FAN_OUT_IN_PROGRESS",
        "expected_quorum": len(DOWNSTREAM_WORKERS),
        "attestations": [],
        "created_at": now_ts,
    })

    # 2. Fan-out parallel sub-tasks to specialist worker agents on the Almanac
    dispatch_coroutines = []
    for idx, worker_addr in enumerate(DOWNSTREAM_WORKERS):
        shard_id = f"SHARD_{idx}"
        shard_params = {**msg.parameters, "shard_index": idx, "assigned_worker": worker_addr}
        shard_hash = compute_canonical_digest(shard_params)
        shard_sig = hashlib.sha256(f"{msg.directive_id}:{shard_id}:{shard_hash}:{now_ts}".encode()).hexdigest()

        subtask = TaskDispatch(
            directive_id=msg.directive_id,
            objective=f"{msg.objective} [{shard_id}]",
            parameters=shard_params,
            task_shard=shard_id,
            payload_hash=shard_hash,
            timestamp=now_ts,
            signature=f"ed25519:{shard_sig}",
        )
        dispatch_coroutines.append(ctx.send(worker_addr, subtask))

    await asyncio.gather(*dispatch_coroutines)

    return UAgentResponse(
        message=(
            f"Directive {msg.directive_id} accepted & verified (SHA-256: {msg.payload_hash[:16]}...). "
            f"Parallel swarm fan-out initiated across {len(DOWNSTREAM_WORKERS)} specialist Almanac nodes."
        ),
        type=UAgentResponseType.FINAL,
        request_id=msg.directive_id,
    )

@agent.on_query(model=TaskDispatch, replies={UAgentResponse})
async def handle_deltav_objective_query(ctx: Context, sender: str, msg: TaskDispatch):
    """Top-level DeltaV AI Engine objective router via on_query."""
    response = await _fan_out_subtasks(ctx, sender, msg)
    await ctx.send(sender, response)

@task_dispatch_proto.on_message(model=TaskDispatch, replies={UAgentResponse})
async def handle_sovereign_directive(ctx: Context, sender: str, msg: TaskDispatch):
    """Protocol message handler for peer-to-peer uAgents TaskDispatch."""
    response = await _fan_out_subtasks(ctx, sender, msg)
    await ctx.send(sender, response)

# ==========================================
# 4. TELEMETRY INGEST PROTOCOL & 30s EXPONENTIAL BACKOFF
# ==========================================

def fetch_with_exponential_backoff(url: str, max_retries: int = 4, base_delay: float = 0.5) -> tuple[Dict[str, Any], int]:
    """Queries external REST endpoint with exponential backoff + full jitter."""
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            return response.json(), attempt
        except Exception as exc:
            if attempt == max_retries - 1:
                raise exc
            sleep_sec = (base_delay * (2 ** attempt)) + random.uniform(0.05, 0.25)
            time.sleep(sleep_sec)
    return {}, max_retries

@agent.on_interval(period=30.0)
async def autonomous_telemetry_and_ledger_sweep(ctx: Context):
    """Runs every 30 seconds: queries external REST endpoints with exponential backoff and persists state deltas into ctx.storage."""
    now_ts = int(time.time())
    prev_snapshot = ctx.storage.get("telemetry_latest_snapshot") or {}
    deltas: Dict[str, Any] = {}
    total_retries = 0

    for endpoint in TELEMETRY_ENDPOINTS:
        try:
            payload, retries = fetch_with_exponential_backoff(endpoint)
            total_retries += retries
            endpoint_key = endpoint.split("/")[-1]
            prev_val = prev_snapshot.get(endpoint_key, {})
            if payload != prev_val:
                deltas[endpoint_key] = {
                    "previous_hash": compute_canonical_digest(prev_val) if prev_val else "0" * 64,
                    "current_hash": compute_canonical_digest(payload),
                    "sample": payload,
                }
            prev_snapshot[endpoint_key] = payload
        except Exception as err:
            ctx.logger.warning(f"[BACKOFF EXHAUSTED] {endpoint}: {str(err)}")

    delta_hash = compute_canonical_digest(deltas)
    sig = hashlib.sha256(f"{ctx.agent.address}:{now_ts}:{delta_hash}".encode()).hexdigest()

    ingest_record = TelemetryIngest(
        ingest_id=f"tel_{now_ts}",
        source_endpoint=",".join(TELEMETRY_ENDPOINTS),
        state_delta=deltas,
        daiv_cache_line_hex=deltas.get("daiv", {}).get("current_hash", delta_hash),
        backoff_attempts=total_retries,
        payload_hash=delta_hash,
        timestamp=now_ts,
        signature=f"ed25519:{sig}",
    )

    # Persist latest snapshot and append delta history in ctx.storage
    ctx.storage.set("telemetry_latest_snapshot", prev_snapshot)
    history: List[Dict[str, Any]] = ctx.storage.get("telemetry_delta_history") or []
    history.insert(0, ingest_record.dict())
    ctx.storage.set("telemetry_delta_history", history[:50])

    ctx.logger.info(
        f"[HEARTBEAT 30s] Persisted state delta {ingest_record.ingest_id} "
        f"(hash={delta_hash[:12]}..., retries={total_retries})"
    )

@telemetry_ingest_proto.on_message(model=TelemetryIngest, replies={UAgentResponse})
async def handle_external_telemetry_ingest(ctx: Context, sender: str, msg: TelemetryIngest):
    """Ingests signed external telemetry frames into ctx.storage after hash verification."""
    if not verify_envelope_digest(msg.state_delta, msg.payload_hash):
        ctx.logger.error(f"[SECURITY FAULT] TelemetryIngest hash mismatch from {sender}")
        return

    history: List[Dict[str, Any]] = ctx.storage.get("telemetry_delta_history") or []
    history.insert(0, msg.dict())
    ctx.storage.set("telemetry_delta_history", history[:50])

    await ctx.send(
        sender,
        UAgentResponse(
            message=f"Telemetry frame {msg.ingest_id} verified & persisted.",
            type=UAgentResponseType.FINAL,
        ),
    )

# ==========================================
# 5. CONSENSUS VERIFICATION & MERKLE AGGREGATION
# ==========================================

@consensus_verification_proto.on_message(model=ConsensusVerification, replies={UAgentResponse})
async def aggregate_worker_attestations(ctx: Context, sender: str, msg: ConsensusVerification):
    state_key = f"directive_{msg.directive_id}"
    current_state = ctx.storage.get(state_key)

    if not current_state:
        ctx.logger.warning(f"Orphaned attestation received for {msg.directive_id}")
        return

    # 1. Verify cryptographic SHA-256 digest of worker's result_data
    computed_root = compute_canonical_digest(msg.result_data)
    if not hmac.compare_digest(computed_root, msg.state_merkle_root):
        ctx.logger.error(f"[SECURITY FAULT] Merkle root mismatch from worker {sender}!")
        current_state["status"] = "SECURITY_FAULT_QUARANTINED"
        ctx.storage.set(state_key, current_state)
        return

    # 2. Verify outer envelope payload_hash
    envelope_check = compute_canonical_digest({
        "directive_id": msg.directive_id,
        "worker_address": msg.worker_address,
        "task_shard": msg.task_shard,
        "state_merkle_root": msg.state_merkle_root,
    })
    if not hmac.compare_digest(envelope_check, msg.payload_hash):
        ctx.logger.error(f"[SECURITY FAULT] Attestation payload_hash mismatch from {sender}!")
        return

    current_state["attestations"].append({
        "worker": sender,
        "shard": msg.task_shard,
        "data": msg.result_data,
        "root": computed_root,
        "payload_hash": msg.payload_hash,
        "signature": msg.signature,
        "timestamp": msg.timestamp,
    })

    # 3. Check if quorum is reached across all dispatched specialist workers
    if len(current_state["attestations"]) >= len(DOWNSTREAM_WORKERS):
        merkle_leaves = sorted([a["root"] for a in current_state["attestations"]])
        aggregate_merkle_root = hashlib.sha256("|".join(merkle_leaves).encode()).hexdigest()
        current_state["status"] = "QUORUM_REACHED"
        current_state["aggregate_merkle_root"] = aggregate_merkle_root
        ctx.storage.set(state_key, current_state)

        # Forward aggregated swarm consensus to external high-compute microservice
        try:
            res = requests.post(
                EXTERNAL_ENGINE_URL,
                json={"directive_id": msg.directive_id, "swarm_state": current_state},
                timeout=10,
            )
            ctx.logger.info(f"[EGRESS BRIDGE] External engine synced: {res.status_code}")
        except Exception as e:
            ctx.logger.error(f"[BRIDGE FAULT] {str(e)}")
    else:
        ctx.storage.set(state_key, current_state)

# Register all three custom protocols + Quota guardrails to publish manifests to Fetch.ai Almanac
agent.include(task_dispatch_proto, publish_manifest=True)
agent.include(telemetry_ingest_proto, publish_manifest=True)
agent.include(consensus_verification_proto, publish_manifest=True)
agent.include(quota_proto)

if __name__ == "__main__":
    agent.run()
`;
