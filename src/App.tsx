/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Volume2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Download,
  Image as ImageIcon,
  Play,
  Square,
  Sliders,
  Terminal,
  Database,
  Layers,
  MessageSquare,
} from 'lucide-react';
import { OmniApexPanel } from './components/OmniApexPanel.tsx';
import { GitHubRepoCenter } from './components/GitHubRepoCenter.tsx';

interface ProtocolSpec {
  name: string;
  version: string;
  digest: string;
  model: string;
  fields: string[];
  published: boolean;
}

interface WorkerNode {
  address: string;
  name: string;
  specialty: string;
  region: string;
  spiffeId: string;
}

interface AttestationItem {
  worker: string;
  worker_name: string;
  shard: string;
  data: Record<string, any>;
  computed_root: string;
  reported_root: string;
  payload_hash: string;
  signature: string;
  timestamp: number;
  verified: boolean;
}

interface DirectiveRecord {
  directive_id: string;
  origin: string;
  entry_point: string;
  objective: string;
  parameters: Record<string, any>;
  payload_hash: string;
  timestamp: number;
  signature: string;
  status: 'FAN_OUT_IN_PROGRESS' | 'QUORUM_REACHED' | 'SECURITY_FAULT_QUARANTINED';
  expected_quorum: number;
  subtasks: Array<Record<string, any>>;
  attestations: AttestationItem[];
  security_alerts: string[];
  aggregate_merkle_root?: string;
  external_bridge_sync?: {
    endpoint: string;
    http_status: number;
    ledger_id: string;
    ledger_hash: string;
    bft_qc_digest: string;
    zk_conservation_verified: boolean;
    synced_at: string;
  };
  created_at: number;
}

interface BackoffTraceStep {
  endpoint: string;
  attempt: number;
  delayMs: number;
  status: 'SUCCESS' | 'RETRY_BACKOFF';
  latencyMs: number;
}

interface TelemetryFrame {
  ingest_id: string;
  source_endpoint: string;
  state_delta: Record<string, any>;
  daiv_cache_line_hex: string;
  backoff_attempts: number;
  payload_hash: string;
  timestamp: number;
  signature: string;
  backoff_trace?: BackoffTraceStep[];
  persisted_at_iso?: string;
}

interface OrchestratorSnapshot {
  almanac: {
    agent_name: string;
    agent_address: string;
    creator_did: string;
    almanac_contract: string;
    deltav_ai_engine_compatible: boolean;
    response_model: string;
    quota_guardrail: {
      protocol: string;
      window_size_minutes: number;
      max_requests: number;
      active_window_requests: number;
    };
    protocols: ProtocolSpec[];
    wallet_balance_afet: string;
    last_heartbeat_ts: number;
  };
  downstreamWorkers: WorkerNode[];
  directives: DirectiveRecord[];
  telemetryHistory: TelemetryFrame[];
  latestTelemetry: Record<string, any>;
  ledgerChain: Array<{
    id: string;
    idempotencyKey: string;
    route: string;
    status: string;
    grossNotionalUsd: number;
    prevLedgerHash: string;
    ledgerHash: string;
    createdAt: string;
  }>;
  rawStorageEntries: Array<{ key: string; byteSize: number; preview: any }>;
  pythonSourceCode: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  timestamp: string;
}

interface GeneratedDiagram {
  id: string;
  prompt: string;
  imageSize: '1K' | '2K' | '4K';
  aspectRatio: string;
  imageUrl: string;
  model: string;
  timestamp: string;
}

const ROLE_PRESETS = [
  {
    id: 'architect',
    label: 'Sovereign Cryptographic Architect',
    instruction:
      'You are the Principal Cryptographic & Multi-Agent Systems Architect for the Sovereign Multi-Agent Orchestrator & Cryptographic Gateway. Provide formal, rigorous explanations of Fetch.ai uAgents protocols (TaskDispatch, TelemetryIngest, ConsensusVerification), SHA-256 Merkle consensus verification, HotStuff 3f+1 BFT quorums, and ZK-Pedersen conservation proofs.',
  },
  {
    id: 'auditor',
    label: 'Byzantine Fault & Security Auditor',
    instruction:
      'You are a Red-Team Cryptographic Security Auditor inspecting uAgents swarm fan-out directives, payload_hash digests, SPIFFE/SVID mTLS identities, and RFC-003 64KB memory slice containment boundaries. Identify digest mismatches, replay risks, and quorum anomalies.',
  },
  {
    id: 'deltav',
    label: 'DeltaV Objective Routing Specialist',
    instruction:
      'You are a Fetch.ai Almanac and DeltaV AI Engine routing specialist. Help operators formulate optimal TaskDispatch objectives, QuotaProtocol rate-limiting configurations, and exponential backoff telemetry pipelines.',
  },
];

const DIAGRAM_PROMPTS = [
  'Clean scientific isometric technical schematic of a Sovereign Multi-Agent Cryptographic Gateway routing parallel task shards to three specialist validator nodes with SHA-256 Merkle tree verification, dark slate background, precision engineering blueprint aesthetic, subtle studio rim lighting',
  'Architectural system diagram of a Byzantine Fault-Tolerant HotStuff 3f+1 Quorum Engine connected to a Fetch.ai Almanac ledger and 128-byte binary telemetry bus, sleek dark metallic surfaces, high contrast technical visualization',
  'Zero-Knowledge Pedersen Commitment and X25519+ML-KEM-1024 post-quantum lattice key exchange enclave schematic, minimalist luxury scientific illustration on dark obsidian canvas',
];

export default function App() {
  const [activeSection, setActiveSection] = useState<
    'orchestrator' | 'telemetry' | 'protocols' | 'copilot' | 'topology'
  >('orchestrator');

  const [snapshot, setSnapshot] = useState<OrchestratorSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [selectedDirectiveId, setSelectedDirectiveId] = useState<string | null>(null);

  // Directive Dispatch Form State
  const [objectiveInput, setObjectiveInput] = useState(
    'Execute Cross-Venue Atomic Liquidity Settlement & DAIV Trajectory Audit'
  );
  const [notionalInput, setNotionalInput] = useState('185000000');
  const [venuesInput, setVenuesInput] = useState('LMAX_INSTITUTIONAL, CURRENEX, COW_SWAP_SOLVER');
  const [entryPointMode, setEntryPointMode] = useState<'on_query (DeltaV)' | 'on_message (TaskDispatchProtocol)'>(
    'on_query (DeltaV)'
  );
  const [simulateTamperedWorker, setSimulateTamperedWorker] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [lastUAgentResponse, setLastUAgentResponse] = useState<Record<string, any> | null>(null);

  // Telemetry & ctx.storage State
  const [sweepingTelemetry, setSweepingTelemetry] = useState(false);
  const [simulateTransientFault, setSimulateTransientFault] = useState(true);
  const [storageSearch, setStorageSearch] = useState('');
  const [countdownSec, setCountdownSec] = useState(30);

  // Code copy state
  const [copiedCode, setCopiedCode] = useState(false);

  // Gemini Multi-Turn Chatbot State
  const [chatModel, setChatModel] = useState<'gemini-4-argon' | 'gemini-3.8-flash' | 'gemini-3.1-flash-lite'>(
    'gemini-4-argon'
  );
  const [selectedRolePreset, setSelectedRolePreset] = useState(ROLE_PRESETS[0].id);
  const [customSystemInstruction, setCustomSystemInstruction] = useState(ROLE_PRESETS[0].instruction);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      role: 'model',
      modelUsed: 'gemini-4-argon',
      text: 'Sovereign Cryptographic Gateway Copilot online. I have real-time visibility into your Fetch.ai uAgents protocols (`TaskDispatchProtocol`, `TelemetryIngestProtocol`, `ConsensusVerificationProtocol`), `ctx.storage` state deltas, and Merkle quorum attestations. How can I assist with your directive routing or formal verification today?',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Gemini 3.8 Flash TTS State
  const [ttsText, setTtsText] = useState(
    'Orchestrator: Directive dir_genesis_98f7e21a accepted on Almanac. Parallel swarm fan-out initiated across three specialist nodes.\nAuditor: Cryptographic SHA-256 Merkle root and HotStuff 3f+1 quorum signatures verified with zero conservation drift.'
  );
  const [ttsVoice, setTtsVoice] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Kore');
  const [ttsMultiSpeaker, setTtsMultiSpeaker] = useState(true);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Gemini 3 Pro Image Preview State (1K, 2K, 4K)
  const [imagePrompt, setImagePrompt] = useState(DIAGRAM_PROMPTS[0]);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '4:3'>('16:9');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [generatedDiagrams, setGeneratedDiagrams] = useState<GeneratedDiagram[]>([]);

  const fetchOrchestratorState = useCallback(async () => {
    try {
      const res = await fetch('/api/uagents/state');
      if (!res.ok) throw new Error('Failed to load orchestrator state');
      const data: OrchestratorSnapshot = await res.json();
      setSnapshot(data);
      setSelectedDirectiveId((prev) => prev || data.directives[0]?.directive_id || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  useEffect(() => {
    fetchOrchestratorState();
    const pollTimer = setInterval(() => {
      fetchOrchestratorState();
      setCountdownSec(30);
    }, 10_000);
    const tickTimer = setInterval(() => {
      setCountdownSec((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => {
      clearInterval(pollTimer);
      clearInterval(tickTimer);
    };
  }, [fetchOrchestratorState]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const handleDispatchDirective = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDispatching(true);
    try {
      const venues = venuesInput
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      const res = await fetch('/api/uagents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: objectiveInput,
          parameters: {
            grossNotionalUsd: Number(notionalInput) || 125000000,
            venues,
            maxDriftBps: 1.4,
          },
          simulateTamperedWorker,
          entryPoint: entryPointMode,
        }),
      });
      const data = await res.json();
      if (data.uagent_response) {
        setLastUAgentResponse(data.uagent_response);
      }
      await fetchOrchestratorState();
      if (data.directive_state?.directive_id) {
        setSelectedDirectiveId(data.directive_state.directive_id);
      }
      setActiveSection('orchestrator');
    } catch (err) {
      console.error(err);
    } finally {
      setDispatching(false);
    }
  };

  const handleManualTelemetrySweep = async () => {
    setSweepingTelemetry(true);
    try {
      await fetch('/api/uagents/telemetry/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulateTransientFault }),
      });
      await fetchOrchestratorState();
      setCountdownSec(30);
    } catch (err) {
      console.error(err);
    } finally {
      setSweepingTelemetry(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };
    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);
    setChatInput('');
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chatModel,
          systemInstruction: customSystemInstruction,
          messages: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gemini chat request failed');
      }
      setChatMessages((prev) => [
        ...prev,
        {
          id: `model_${Date.now()}`,
          role: 'model',
          text: data.reply,
          modelUsed: data.model,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      setChatError(err.message || 'Failed to communicate with Gemini chat endpoint');
    } finally {
      setChatLoading(false);
    }
  };

  const handleSynthesizeSpeech = async (overrideText?: string, forceSingleSpeaker?: boolean) => {
    const textToSpeak = overrideText || ttsText;
    if (!textToSpeak.trim() || ttsLoading) return;
    setTtsLoading(true);
    setTtsError(null);

    try {
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          voiceName: ttsVoice,
          multiSpeaker: forceSingleSpeaker ? false : ttsMultiSpeaker,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'TTS synthesis failed');
      }
      const dataUri = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
      setTtsAudioUrl(dataUri);

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(dataUri);
      audioRef.current = audio;
      audio.onplay = () => setIsPlayingAudio(true);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onpause = () => setIsPlayingAudio(false);
      await audio.play();
    } catch (err: any) {
      setTtsError(err.message || 'Speech generation error');
    } finally {
      setTtsLoading(false);
    }
  };

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingAudio(false);
    }
  };

  const handleGenerateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePrompt.trim() || generatingImage) return;
    setGeneratingImage(true);
    setImageError(null);

    try {
      const res = await fetch('/api/gemini/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          imageSize,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Image generation failed');
      }
      const newDiagram: GeneratedDiagram = {
        id: `img_${Date.now()}`,
        prompt: imagePrompt,
        imageSize: data.imageSize || imageSize,
        aspectRatio: data.aspectRatio || aspectRatio,
        imageUrl: data.imageUrl,
        model: data.model || 'gemini-3-pro-image-preview',
        timestamp: new Date().toLocaleTimeString(),
      };
      setGeneratedDiagrams((prev) => [newDiagram, ...prev]);
    } catch (err: any) {
      setImageError(err.message || 'Failed to generate image');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleCopyPython = () => {
    if (!snapshot?.pythonSourceCode) return;
    navigator.clipboard.writeText(snapshot.pythonSourceCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadPython = () => {
    if (!snapshot?.pythonSourceCode) return;
    const blob = new Blob([snapshot.pythonSourceCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uagents_sovereign_orchestrator.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedDirective =
    snapshot?.directives.find((d) => d.directive_id === selectedDirectiveId) || snapshot?.directives[0] || null;

  const filteredStorageEntries = (snapshot?.rawStorageEntries || []).filter((entry) =>
    entry.key.toLowerCase().includes(storageSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* STRICT TOP BAR CONTRACT: 3 ZONES SEPARATED BY gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/90 bg-[#0B0F17]/95 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('orchestrator');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 font-display whitespace-nowrap shrink-0"
        >
          Sovereign Gateway
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            type="button"
            onClick={() => setActiveSection('orchestrator')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeSection === 'orchestrator' ? 'text-slate-100 border-sky-400' : 'border-transparent'
            }`}
          >
            Swarm Orchestrator
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('telemetry')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeSection === 'telemetry' ? 'text-slate-100 border-sky-400' : 'border-transparent'
            }`}
          >
            Telemetry & Storage
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('protocols')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeSection === 'protocols' ? 'text-slate-100 border-sky-400' : 'border-transparent'
            }`}
          >
            Protocols, SDK & GitHub Repo
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('copilot')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeSection === 'copilot' ? 'text-slate-100 border-sky-400' : 'border-transparent'
            }`}
          >
            Gemini Copilot & Voice
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('topology')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeSection === 'topology' ? 'text-slate-100 border-sky-400' : 'border-transparent'
            }`}
          >
            Topology Studio
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveSection('orchestrator');
              handleDispatchDirective();
            }}
            disabled={dispatching}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 rounded-lg hover:bg-sky-300 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {dispatching ? 'Dispatching Swarm...' : 'Dispatch Directive'}
          </button>
        </div>
      </header>

      {/* Mobile View Switcher */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto px-4 py-2.5 border-b border-slate-800 bg-[#0F1623]">
        {(
          [
            ['orchestrator', 'Swarm'],
            ['telemetry', 'Telemetry'],
            ['protocols', 'Protocols'],
            ['copilot', 'Copilot & TTS'],
            ['topology', 'Topology 4K'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeSection === id ? 'bg-sky-400 text-slate-950' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Content Container (1440px Desktop Presence) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Identity & Almanac Bar (Zero-Pill Clean Unboxed Metadata with Middot Separators) */}
        <section className="pb-6 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span>rea-autonomous-orchestrator-engine</span>
              <span aria-hidden="true">·</span>
              <span>Almanac Registered</span>
              <span aria-hidden="true">·</span>
              <span>DeltaV UAgentResponse Router</span>
              <span aria-hidden="true">·</span>
              <span>HotStuff 3f+1 BFT</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 font-display">
              Sovereign Multi-Agent Orchestrator & Cryptographic Gateway
            </h1>
            <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
              Top-level DeltaV objective router and peer-to-peer Fetch.ai uAgents protocol gateway enforcing SHA-256
              Merkle attestation roots, 30-second exponential-backoff telemetry sweeps into{' '}
              <code className="text-slate-200 font-mono">ctx.storage</code>, and zero-knowledge conservation proofs.
            </p>
          </div>

          {/* Key Quantitative Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80 shrink-0">
            <div>
              <div className="text-xs text-slate-400">Almanac Quota</div>
              <div className="text-lg font-semibold text-slate-100 font-mono tabular-nums mt-0.5">30 req / min</div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">SovereignQuota v1.0</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Downstream Swarm</div>
              <div className="text-lg font-semibold text-slate-100 font-mono tabular-nums mt-0.5">
                {snapshot?.downstreamWorkers.length || 3} Nodes
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">3/3 Merkle Quorum</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Telemetry Interval</div>
              <div className="text-lg font-semibold text-sky-400 font-mono tabular-nums mt-0.5">
                30s ({countdownSec}s)
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">Exp Backoff + Jitter</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Ledger Chain Height</div>
              <div className="text-lg font-semibold text-slate-100 font-mono tabular-nums mt-0.5">
                {snapshot?.ledgerChain.length || 1} Blocks
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">RFC-003 ≤ 64KB</div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            VIEW 1: SWARM ORCHESTRATOR (DeltaV on_query, Fan-Out & Merkle Audit)
            =================================================================== */}
        {activeSection === 'orchestrator' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Directive Ingress & Swarm Fan-Out Dispatcher */}
              <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    TaskDispatchProtocol v2.1.0 · DeltaV on_query
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100 font-display">
                    01. Objective Router & Parallel Swarm Fan-Out
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Submit a high-level objective via <code className="text-slate-200">on_query</code> or{' '}
                    <code className="text-slate-200">TaskDispatch</code>. The gateway persists initial state in{' '}
                    <code className="text-slate-200">ctx.storage</code>, fans out parallel shards to specialist worker
                    addresses, and verifies returned SHA-256 Merkle roots.
                  </p>
                </div>

                <form onSubmit={handleDispatchDirective} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Ingress Handler Entry Point
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setEntryPointMode('on_query (DeltaV)')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          entryPointMode === 'on_query (DeltaV)'
                            ? 'bg-slate-800 text-slate-100'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        @agent.on_query (DeltaV)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryPointMode('on_message (TaskDispatchProtocol)')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          entryPointMode === 'on_message (TaskDispatchProtocol)'
                            ? 'bg-slate-800 text-slate-100'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        @task_dispatch_proto
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Sovereign Directive Objective
                    </label>
                    <input
                      type="text"
                      value={objectiveInput}
                      onChange={(e) => setObjectiveInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
                      placeholder="Enter routing or settlement objective..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Gross Notional (USD)
                      </label>
                      <input
                        type="number"
                        value={notionalInput}
                        onChange={(e) => setNotionalInput(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Execution Venues
                      </label>
                      <input
                        type="text"
                        value={venuesInput}
                        onChange={(e) => setVenuesInput(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm font-mono bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={simulateTamperedWorker}
                        onChange={(e) => setSimulateTamperedWorker(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 bg-[#0B0F17] text-sky-400 focus:ring-0"
                      />
                      <span>
                        <strong className="text-slate-200">Simulate Byzantine Hash Tampering on Worker Shard 1:</strong>{' '}
                        Injects a corrupted <code className="font-mono text-amber-300">state_merkle_root</code> from
                        Specialist Agent B to verify <code className="font-mono">ConsensusVerificationProtocol</code>{' '}
                        digest rejection & quarantine.
                      </span>
                    </label>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={dispatching}
                      className="flex-1 py-2.5 px-4 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {dispatching ? 'Executing Parallel Fan-Out...' : 'Execute Parallel Swarm Fan-Out'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDirective) {
                          const summary = `Directive ${selectedDirective.directive_id} status is ${selectedDirective.status}. Objective: ${selectedDirective.objective}. Dispatched across ${selectedDirective.expected_quorum} specialist Almanac workers.`;
                          setTtsText(summary);
                          handleSynthesizeSpeech(summary, true);
                        }
                      }}
                      disabled={ttsLoading}
                      className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4 text-sky-400" />
                      <span>{ttsLoading ? 'Synthesizing...' : 'Read Briefing'}</span>
                    </button>
                  </div>
                </form>

                {/* Immediate UAgentResponse Envelope Preview */}
                {lastUAgentResponse && (
                  <div className="pt-4 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                      <span>DeltaV UAgentResponse (Immediate Ack)</span>
                      <span>type: {lastUAgentResponse.type}</span>
                    </div>
                    <pre className="p-3 bg-[#0B0F17] border border-slate-800/90 rounded-lg text-xs font-mono text-sky-300 overflow-x-auto leading-relaxed">
                      {JSON.stringify(lastUAgentResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Right Column: Live Swarm Fan-Out & Merkle Consensus Verification Inspector */}
              <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      ConsensusVerificationProtocol v2.1.0 · Merkle Root & Egress Bridge
                    </div>
                    <h2 className="text-lg font-semibold text-slate-100 font-display mt-0.5">
                      02. Downstream Worker Attestations & Digest Verification
                    </h2>
                  </div>

                  {/* Directive Selector */}
                  {snapshot && snapshot.directives.length > 0 && (
                    <select
                      value={selectedDirective?.directive_id || ''}
                      onChange={(e) => setSelectedDirectiveId(e.target.value)}
                      className="px-3 py-1.5 text-xs font-mono bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-400"
                    >
                      {snapshot.directives.map((d) => (
                        <option key={d.directive_id} value={d.directive_id}>
                          {d.directive_id} ({d.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {loadingSnapshot ? (
                  <div className="space-y-3 py-8">
                    <div className="h-10 bg-slate-800/50 rounded animate-pulse" />
                    <div className="h-24 bg-slate-800/50 rounded animate-pulse" />
                    <div className="h-24 bg-slate-800/50 rounded animate-pulse" />
                  </div>
                ) : selectedDirective ? (
                  <div className="space-y-6">
                    {/* Directive Summary Header */}
                    <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                          {selectedDirective.status === 'QUORUM_REACHED' ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                              <ShieldCheck className="w-4 h-4" />
                              QUORUM_REACHED ({selectedDirective.attestations.filter((a) => a.verified).length}/
                              {selectedDirective.expected_quorum})
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                              <ShieldAlert className="w-4 h-4" />
                              {selectedDirective.status}
                            </span>
                          )}
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span className="text-slate-400">{selectedDirective.entry_point}</span>
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span className="text-slate-400">ts: {selectedDirective.timestamp}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-400 tabular-nums">
                          ID: {selectedDirective.directive_id}
                        </span>
                      </div>

                      <div className="text-sm font-medium text-slate-100">{selectedDirective.objective}</div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs font-mono tabular-nums text-slate-400">
                        <div className="truncate">
                          <span className="text-slate-500">payload_hash: </span>
                          <span className="text-slate-300">{selectedDirective.payload_hash}</span>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-500">signature: </span>
                          <span className="text-slate-300">{selectedDirective.signature}</span>
                        </div>
                      </div>

                      {selectedDirective.security_alerts && selectedDirective.security_alerts.length > 0 && (
                        <div className="p-3 bg-rose-950/40 border border-rose-800/70 rounded text-xs font-mono text-rose-300 space-y-1">
                          {selectedDirective.security_alerts.map((alert, i) => (
                            <div key={i}>{alert}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Parallel Worker Attestation Table */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-slate-300">
                        Specialist Worker Shard Attestations (Canonical SHA-256 Digest Check)
                      </div>
                      <div className="overflow-x-auto border border-slate-800 rounded-lg">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 bg-[#0B0F17] text-[11px] font-medium text-slate-400">
                              <th className="py-2.5 px-3">Shard</th>
                              <th className="py-2.5 px-3">Specialist Worker Address</th>
                              <th className="py-2.5 px-3">Computed SHA-256 Root</th>
                              <th className="py-2.5 px-3">Reported Merkle Root</th>
                              <th className="py-2.5 px-3 text-right">Digest Check</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70 text-xs font-mono tabular-nums">
                            {selectedDirective.attestations.map((att) => (
                              <tr key={att.shard} className="hover:bg-slate-800/30">
                                <td className="py-2.5 px-3 text-slate-200 font-semibold">{att.shard}</td>
                                <td className="py-2.5 px-3 text-slate-400 max-w-[180px] truncate" title={att.worker}>
                                  {att.worker}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">{att.computed_root.slice(0, 16)}...</td>
                                <td
                                  className={`py-2.5 px-3 ${
                                    att.verified ? 'text-slate-300' : 'text-rose-400 font-semibold'
                                  }`}
                                >
                                  {att.reported_root.slice(0, 16)}...
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {att.verified ? (
                                    <span className="text-emerald-400">VERIFIED</span>
                                  ) : (
                                    <span className="text-rose-400 font-semibold">HASH_MISMATCH</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* External High-Compute Microservice Egress Bridge Summary */}
                    {selectedDirective.external_bridge_sync && (
                      <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                          <span>Egress Bridge Synced ({selectedDirective.external_bridge_sync.endpoint})</span>
                          <span className="text-emerald-400">
                            HTTP {selectedDirective.external_bridge_sync.http_status} · ZK Conservation Verified
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono tabular-nums text-slate-300">
                          <div className="truncate">
                            <span className="text-slate-500">Aggregate Merkle Root: </span>
                            {selectedDirective.aggregate_merkle_root}
                          </div>
                          <div className="truncate">
                            <span className="text-slate-500">HotStuff 3f+1 QC: </span>
                            {selectedDirective.external_bridge_sync.bft_qc_digest}
                          </div>
                          <div className="truncate">
                            <span className="text-slate-500">Hash-Chained Ledger ID: </span>
                            {selectedDirective.external_bridge_sync.ledger_id}
                          </div>
                          <div className="truncate">
                            <span className="text-slate-500">Ledger Block Hash: </span>
                            {selectedDirective.external_bridge_sync.ledger_hash}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 py-8 text-center">
                    No directives recorded yet. Use the form on the left to dispatch your first swarm directive.
                  </div>
                )}
              </div>
            </div>

            {/* Downstream Specialist Worker Directory & Hash-Chained Ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
                <div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    Fetch.ai Almanac Specialist Registry
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 font-display mt-0.5">
                    Downstream Specialist Worker Addresses
                  </h3>
                </div>
                <div className="divide-y divide-slate-800">
                  {(snapshot?.downstreamWorkers || []).map((w, idx) => (
                    <div key={w.address} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">
                          SHARD_{idx} · {w.name}
                        </span>
                        <span className="font-mono text-slate-400 tabular-nums">{w.region}</span>
                      </div>
                      <div className="text-xs font-mono text-sky-400 truncate" title={w.address}>
                        {w.address}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">{w.spiffeId}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      SERIALIZABLE Hash-Chained Ledger & Transactional Outbox
                    </div>
                    <h3 className="text-base font-semibold text-slate-100 font-display mt-0.5">
                      Immutable State Transition Ledger Chain
                    </h3>
                  </div>
                </div>
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#0B0F17] text-[11px] font-medium text-slate-400">
                        <th className="py-2.5 px-3">Ledger ID</th>
                        <th className="py-2.5 px-3">Directive / Idempotency</th>
                        <th className="py-2.5 px-3 text-right">Notional (USD)</th>
                        <th className="py-2.5 px-3">Prev Hash → Block Hash</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-xs font-mono tabular-nums">
                      {(snapshot?.ledgerChain || []).map((row) => (
                        <tr key={row.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 text-slate-200">{row.id}</td>
                          <td className="py-2.5 px-3 text-slate-400">{row.idempotencyKey}</td>
                          <td className="py-2.5 px-3 text-right text-slate-200">
                            ${Number(row.grossNotionalUsd).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {row.prevLedgerHash.slice(0, 8)}... →{' '}
                            <span className="text-sky-300">{row.ledgerHash.slice(0, 12)}...</span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={
                                row.status === 'SETTLED' ? 'text-emerald-400' : 'text-rose-400 font-semibold'
                              }
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <OmniApexPanel onStateUpdated={fetchOrchestratorState} />
            <GitHubRepoCenter />
          </div>
        )}

        {/* ===================================================================
            VIEW 2: TELEMETRY & CTX.STORAGE (30s Exponential Backoff Poller)
            =================================================================== */}
        {activeSection === 'telemetry' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left: 30s Interval Task & Exponential Backoff Controller */}
              <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      @agent.on_interval(period=30.0) · TelemetryIngestProtocol v2.1.0
                    </div>
                    <h2 className="text-lg font-semibold text-slate-100 font-display mt-0.5">
                      30-Second REST Telemetry Poller & Exponential Backoff
                    </h2>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-sky-400 shrink-0">
                    Next auto-sweep: {countdownSec}s
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Queries <code className="text-slate-200">/api/v1/telemetry/daiv</code>,{' '}
                  <code className="text-slate-200">/api/v1/consensus/quorum</code>, and{' '}
                  <code className="text-slate-200">/api/v1/liquidity/depth</code> every 30 seconds using{' '}
                  <code className="text-slate-200">base_delay * 2^attempt + jitter</code>. Computes canonical SHA-256
                  state deltas and persists signed <code className="text-slate-200">TelemetryIngest</code> frames into{' '}
                  <code className="text-slate-200">ctx.storage</code>.
                </p>

                <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg space-y-3">
                  <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={simulateTransientFault}
                      onChange={(e) => setSimulateTransientFault(e.target.checked)}
                      className="rounded border-slate-700 bg-[#0B0F17] text-sky-400 focus:ring-0"
                    />
                    <span>
                      Inject transient HTTP 503 on Attempt 1 & 2 to observe exponential backoff retry delays (
                      <code className="font-mono text-sky-300">2^attempt + jitter</code>) before recovery
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={handleManualTelemetrySweep}
                    disabled={sweepingTelemetry}
                    className="w-full py-2.5 px-4 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${sweepingTelemetry ? 'animate-spin' : ''}`} />
                    <span>
                      {sweepingTelemetry
                        ? 'Executing Exponential Backoff Sweep...'
                        : 'Trigger Immediate 30s Telemetry Sweep Now'}
                    </span>
                  </button>
                </div>

                {/* Latest Backoff Execution Trace */}
                {snapshot?.telemetryHistory?.[0] && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                      <span>Latest Ingest Frame: {snapshot.telemetryHistory[0].ingest_id}</span>
                      <span>Backoff Retries: {snapshot.telemetryHistory[0].backoff_attempts}</span>
                    </div>
                    <div className="overflow-x-auto border border-slate-800 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-[#0B0F17] text-[11px] font-medium text-slate-400">
                            <th className="py-2 px-3">Target REST Endpoint</th>
                            <th className="py-2 px-3 text-right">Attempt</th>
                            <th className="py-2 px-3 text-right">Backoff Delay</th>
                            <th className="py-2 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70 text-xs font-mono tabular-nums">
                          {(snapshot.telemetryHistory[0].backoff_trace || []).map((step, i) => (
                            <tr key={i}>
                              <td className="py-2 px-3 text-slate-300">{step.endpoint}</td>
                              <td className="py-2 px-3 text-right text-slate-400">#{step.attempt}</td>
                              <td className="py-2 px-3 text-right text-slate-400">{step.delayMs} ms</td>
                              <td className="py-2 px-3 text-right">
                                <span
                                  className={
                                    step.status === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'
                                  }
                                >
                                  {step.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 128-Byte DAIV Cache-Line Binary Telemetry Inspector */}
                {snapshot?.latestTelemetry?.daiv && (
                  <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
                      <span>128-Byte DAIV Binary Frame (/api/v1/telemetry/daiv)</span>
                      <span className="text-emerald-400">CRC32 Verified · 0 bps Drift</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 space-y-1 break-all">
                      <div>
                        <span className="text-slate-500">Cache Line 0 (0x00..0x3F): </span>
                        <span className="text-sky-300">{snapshot.latestTelemetry.daiv.cacheLine0Hex}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Cache Line 1 (0x40..0x7F): </span>
                        <span className="text-slate-300">{snapshot.latestTelemetry.daiv.cacheLine1Hex}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Live Agentverse ctx.storage Key-Value State Deltas */}
              <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      Agentverse Key-Value Persistence · ctx.storage
                    </div>
                    <h2 className="text-lg font-semibold text-slate-100 font-display mt-0.5">
                      Persisted ctx.storage State & Delta History
                    </h2>
                  </div>
                  <input
                    type="text"
                    value={storageSearch}
                    onChange={(e) => setStorageSearch(e.target.value)}
                    placeholder="Filter ctx.storage keys..."
                    className="px-3 py-1.5 text-xs font-mono bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                  {filteredStorageEntries.map((item) => (
                    <div key={item.key} className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="text-sky-400 font-semibold">ctx.storage.get("{item.key}")</span>
                        <span className="text-slate-500">{item.byteSize.toLocaleString()} bytes</span>
                      </div>
                      <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                        {JSON.stringify(item.preview, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            VIEW 3: PROTOCOLS & PYTHON uAGENTS SDK SOURCE
            =================================================================== */}
        {activeSection === 'protocols' && (
          <div className="space-y-8">
            {/* Three Custom Protocols & Pydantic Schema Specification */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(snapshot?.almanac.protocols || []).map((proto, idx) => (
                <div key={proto.name} className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
                    <span>0{idx + 1}. Protocol v{proto.version}</span>
                    <span className="text-emerald-400">publish_manifest=True</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-100 font-display">{proto.name}</h3>
                    <div className="text-xs font-mono text-sky-400 mt-0.5">Pydantic Model: {proto.model}(Model)</div>
                  </div>
                  <div className="text-xs font-mono text-slate-400 break-all">
                    <span className="text-slate-500">Almanac Digest: </span>
                    {proto.digest}
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="text-xs font-medium text-slate-300">Strict Schema Fields:</div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-mono text-slate-400">
                      {proto.fields.map((f, i) => (
                        <React.Fragment key={f}>
                          <span
                            className={
                              f === 'payload_hash' || f === 'timestamp' || f === 'signature'
                                ? 'text-sky-300 font-semibold'
                                : 'text-slate-300'
                            }
                          >
                            {f}
                          </span>
                          {i < proto.fields.length - 1 && <span aria-hidden="true">·</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Full Production Python uAgents Code Viewer */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    uagents_sovereign_orchestrator.py · Fetch.ai Almanac & DeltaV AI Engine Ready
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100 font-display mt-0.5">
                    Complete Sovereign uAgents Python Implementation
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyPython}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'Copied to Clipboard' : 'Copy Python Code'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPython}
                    className="px-3.5 py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .py</span>
                  </button>
                </div>
              </div>

              <pre className="p-5 bg-[#0B0F17] border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto max-h-[640px] leading-relaxed">
                {snapshot?.pythonSourceCode || 'Loading Python source...'}
              </pre>
            </div>

            <GitHubRepoCenter />
          </div>
        )}

        {/* ===================================================================
            VIEW 4: GEMINI MULTI-TURN COPILOT & VOICE DESIGN TTS
            =================================================================== */}
        {activeSection === 'copilot' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Cols: Multi-Turn Gemini Chatbot (gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite) */}
            <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col h-[700px]">
              <div className="pb-4 border-b border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      Multi-Turn Reasoning Thread · Live ctx.storage Context Grounding
                    </div>
                    <h2 className="text-lg font-semibold text-slate-100 font-display mt-0.5">
                      Sovereign Architecture & Security Copilot
                    </h2>
                  </div>

                  {/* Model Tier Selector */}
                  <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
                    {(
                      [
                        ['gemini-4-argon', 'Argon (Complex)'],
                        ['gemini-3.8-flash', '3.8 Flash (General)'],
                        ['gemini-3.1-flash-lite', '3.1 Lite (Fast)'],
                      ] as const
                    ).map(([modelId, label]) => (
                      <button
                        key={modelId}
                        type="button"
                        onClick={() => setChatModel(modelId)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          chatModel === modelId
                            ? 'bg-sky-400 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* System Instruction Role Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-4">
                    <select
                      value={selectedRolePreset}
                      onChange={(e) => {
                        const preset = ROLE_PRESETS.find((r) => r.id === e.target.value);
                        if (preset) {
                          setSelectedRolePreset(preset.id);
                          setCustomSystemInstruction(preset.instruction);
                        }
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-400"
                    >
                      {ROLE_PRESETS.map((r) => (
                        <option key={r.id} value={r.id}>
                          Role: {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      value={customSystemInstruction}
                      onChange={(e) => setCustomSystemInstruction(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-sky-400"
                      placeholder="System instruction role definition..."
                    />
                  </div>
                </div>
              </div>

              {/* Scrollable Message Thread */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg border ${
                      msg.role === 'user'
                        ? 'bg-[#0B0F17] border-slate-800 ml-8'
                        : 'bg-[#0F172A] border-slate-800/90 mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums mb-1.5">
                      <span>
                        {msg.role === 'user' ? 'Operator' : 'Copilot'}
                        {msg.modelUsed ? ` · ${msg.modelUsed}` : ''}
                      </span>
                      <div className="flex items-center gap-3">
                        <span>{msg.timestamp}</span>
                        {msg.role === 'model' && (
                          <button
                            type="button"
                            onClick={() => {
                              setTtsText(msg.text.slice(0, 500));
                              handleSynthesizeSpeech(msg.text.slice(0, 500), true);
                            }}
                            className="text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                            title="Speak response with gemini-3.8-flash-tts"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Speak</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="p-4 rounded-lg bg-[#0F172A] border border-slate-800 text-xs font-mono text-slate-400 animate-pulse">
                    Synthesizing response with {chatModel}...
                  </div>
                )}
                {chatError && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
                    {chatError}
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChat} className="pt-3 border-t border-slate-800 flex items-center gap-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Ask ${chatModel} about Merkle verification, Almanac manifests, or BFT quorums...`}
                  className="flex-1 px-4 py-2.5 text-sm bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2.5 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </form>
            </div>

            {/* Right 5 Cols: Gemini 3.8 Flash TTS Audio Briefing & Voice Design Studio */}
            <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
              <div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  Model: gemini-3.8-flash-tts · 24kHz WAV Audio Output
                </div>
                <h2 className="text-lg font-semibold text-slate-100 font-display mt-0.5">
                  Acoustic Briefing & Dual-Speaker Voice Studio
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  Convert cryptographic consensus reports, security alerts, or dual-speaker Orchestrator/Auditor
                  dialogues into high-clarity speech using <code className="text-slate-200">gemini-3.8-flash-tts</code>.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Primary Voice Persona</label>
                    <select
                      value={ttsVoice}
                      onChange={(e) => setTtsVoice(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-400"
                    >
                      <option value="Kore">Kore (Authoritative)</option>
                      <option value="Puck">Puck (Analytical)</option>
                      <option value="Charon">Charon (Deep Command)</option>
                      <option value="Fenrir">Fenrir (Tactical)</option>
                      <option value="Zephyr">Zephyr (Crisp Briefing)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Speaker Mode</label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setTtsMultiSpeaker(true)}
                        className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                          ttsMultiSpeaker ? 'bg-slate-800 text-slate-100' : 'text-slate-400'
                        }`}
                      >
                        Dual-Speaker
                      </button>
                      <button
                        type="button"
                        onClick={() => setTtsMultiSpeaker(false)}
                        className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                          !ttsMultiSpeaker ? 'bg-slate-800 text-slate-100' : 'text-slate-400'
                        }`}
                      >
                        Single Voice
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Briefing Script (Supports <code className="font-mono text-sky-300">&lt;breath&gt;</code> and{' '}
                    <code className="font-mono text-sky-300">|yeah|</code> backchanneling)
                  </label>
                  <textarea
                    rows={5}
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    className="w-full p-3 text-xs font-mono bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSynthesizeSpeech()}
                    disabled={ttsLoading}
                    className="flex-1 py-2.5 px-4 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    <span>{ttsLoading ? 'Synthesizing Audio...' : 'Synthesize & Play (gemini-3.8-flash-tts)'}</span>
                  </button>
                  {isPlayingAudio && (
                    <button
                      type="button"
                      onClick={handleStopAudio}
                      className="py-2.5 px-4 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </button>
                  )}
                </div>

                {ttsError && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
                    {ttsError}
                  </div>
                )}

                {ttsAudioUrl && (
                  <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg space-y-2">
                    <div className="text-xs font-mono text-slate-400">Generated 24kHz WAV Stream</div>
                    <audio controls src={ttsAudioUrl} className="w-full h-9" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            VIEW 5: VISUAL TOPOLOGY STUDIO (gemini-3-pro-image-preview 1K/2K/4K)
            =================================================================== */}
        {activeSection === 'topology' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 5 Cols: Image Generation Controls (1K, 2K, 4K) */}
              <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
                <div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    Model: gemini-3-pro-image-preview · Resolution: 1K / 2K / 4K
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100 font-display mt-0.5">
                    Cryptographic & Swarm Topology Visualizer
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    Synthesize high-resolution architectural schematics of your multi-agent swarm, Merkle consensus
                    trees, and post-quantum enclaves at 1K, 2K, or 4K resolution.
                  </p>
                </div>

                <form onSubmit={handleGenerateDiagram} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Output Image Resolution (imageSize)
                    </label>
                    <div className="grid grid-cols-3 gap-2 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
                      {(['1K', '2K', '4K'] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setImageSize(size)}
                          className={`py-2 text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer ${
                            imageSize === size
                              ? 'bg-sky-400 text-slate-950'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {size} Resolution
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-2 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
                      {(['16:9', '1:1', '4:3'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAspectRatio(ratio)}
                          className={`py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                            aspectRatio === ratio
                              ? 'bg-slate-800 text-slate-100 font-semibold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Architectural Blueprint Prompt
                    </label>
                    <textarea
                      rows={4}
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      className="w-full p-3 text-xs bg-[#0B0F17] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-400">Preset Blueprint Prompts:</div>
                    <div className="flex flex-col gap-1.5">
                      {DIAGRAM_PROMPTS.map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setImagePrompt(preset)}
                          className="text-left px-3 py-2 text-xs bg-[#0B0F17] hover:bg-slate-800/60 border border-slate-800 rounded-lg text-slate-300 truncate cursor-pointer"
                        >
                          0{i + 1}. {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={generatingImage}
                    className="w-full py-2.5 px-4 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>
                      {generatingImage
                        ? `Rendering ${imageSize} Topology Schematic...`
                        : `Generate ${imageSize} Schematic (gemini-3-pro-image-preview)`}
                    </span>
                  </button>
                </form>

                {imageError && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
                    {imageError}
                  </div>
                )}
              </div>

              {/* Right 7 Cols: Rendered High-Resolution Topology Gallery */}
              <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      Synthesized Visual Artifacts · Zero-Broken-Image Resilient Canvas
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100 font-display mt-0.5">
                      Rendered Architecture & Enclave Schematics
                    </h3>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {generatedDiagrams.length} Artifacts
                  </span>
                </div>

                {generatingImage && (
                  <div className="h-72 bg-[#0B0F17] border border-slate-800 rounded-lg flex flex-col items-center justify-center gap-3 p-6">
                    <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
                    <div className="text-xs font-mono text-slate-300">
                      Synthesizing {imageSize} ({aspectRatio}) visual schematic with gemini-3-pro-image-preview...
                    </div>
                  </div>
                )}

                {generatedDiagrams.length === 0 && !generatingImage ? (
                  <div className="h-72 bg-[#0B0F17] border border-slate-800 rounded-lg flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <Layers className="w-8 h-8 text-slate-500" />
                    <div className="space-y-1 max-w-md">
                      <div className="text-sm font-medium text-slate-200">No Topology Schematics Generated Yet</div>
                      <p className="text-xs text-slate-400">
                        Select 1K, 2K, or 4K resolution on the left and click Generate to render a high-resolution
                        diagram of your Sovereign Multi-Agent Orchestrator.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {generatedDiagrams.map((item) => (
                      <div key={item.id} className="bg-[#0B0F17] border border-slate-800 rounded-lg overflow-hidden">
                        <div className="relative bg-slate-950">
                          <img
                            src={item.imageUrl}
                            alt={item.prompt}
                            referrerPolicy="no-referrer"
                            className="w-full max-h-[460px] object-contain mx-auto"
                          />
                        </div>
                        <div className="p-4 space-y-2 border-t border-slate-800">
                          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
                            <span>
                              {item.model} · Resolution: {item.imageSize} · Aspect: {item.aspectRatio}
                            </span>
                            <a
                              href={item.imageUrl}
                              download={`sovereign_topology_${item.imageSize}_${item.id}.png`}
                              className="text-sky-400 hover:text-sky-300 flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download PNG</span>
                            </a>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{item.prompt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Quiet Footer (No Ornamental Telemetry Tickers) */}
      <footer className="mt-auto border-t border-slate-800/80 px-6 py-4 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-mono tabular-nums">
          <div>
            rea-autonomous-orchestrator-engine · Sovereign Operator DID: {snapshot?.almanac.creator_did || 'did:nexus:dcb7f346c0caf740'}
          </div>
          <div>
            Fetch.ai uAgents v2.1.0 · HotStuff 3f+1 BFT · X25519+ML-KEM-1024
          </div>
        </div>
      </footer>
    </div>
  );
}
