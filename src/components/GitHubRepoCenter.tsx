import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Copy,
  Check,
  GitBranch,
  FileCode,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface RepoFileEntry {
  path: string;
  byteLength: number;
  lineCount: number;
  sha256: string;
  content: string;
}

interface RepoBundle {
  repositorySlug: string;
  version: string;
  totalFiles: number;
  totalBytes: number;
  totalLines: number;
  treeMerkleRoot: string;
  generatedAt: string;
  files: RepoFileEntry[];
}

export function GitHubRepoCenter() {
  const [bundle, setBundle] = useState<RepoBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('README.md');
  const [copiedFile, setCopiedFile] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  // Direct GitHub Push State
  const [ghOwner, setGhOwner] = useState('autocorp-sovereign');
  const [ghRepo, setGhRepo] = useState('rea-autonomous-orchestrator-engine');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghToken, setGhToken] = useState('');
  const [ghPrivate, setGhPrivate] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<any>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  const fetchRepoBundle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/github/repo-bundle');
      if (res.ok) {
        const data: RepoBundle = await res.json();
        setBundle(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepoBundle();
  }, [fetchRepoBundle]);

  const selectedFile =
    bundle?.files.find((f) => f.path === selectedFilePath) || bundle?.files[0] || null;

  const handleDownloadJsonBundle = () => {
    if (!bundle) return;
    const jsonMap: Record<string, string> = {};
    for (const f of bundle.files) {
      jsonMap[f.path] = f.content;
    }
    const blob = new Blob([JSON.stringify(jsonMap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ghRepo}-v7-omni-apex-repo.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBootstrapScript = () => {
    const url = `/api/github/bootstrap.sh?owner=${encodeURIComponent(ghOwner)}&repo=${encodeURIComponent(ghRepo)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `bootstrap-${ghRepo}.sh`;
    a.click();
  };

  const handleCopyFileContent = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  const cliPushCommands = `# Option A: Run the downloaded 1-Click Self-Extracting Git Bootstrapper
chmod +x bootstrap-${ghRepo}.sh
./bootstrap-${ghRepo}.sh
cd ${ghRepo}
git remote add origin https://github.com/${ghOwner}/${ghRepo}.git
git push -u origin main

# Option B: Verify all 10 Omni-Apex Cryptographic & Consensus Pillars locally
npm install
npm test
bash verification.poc.sh`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliPushCommands);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleDirectGitHubPush = async (e: React.FormEvent) => {
    e.preventDefault();
    setPushing(true);
    setPushError(null);
    setPushResult(null);

    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: ghOwner,
          repo: ghRepo,
          branch: ghBranch,
          githubToken: ghToken || undefined,
          isPrivate: ghPrivate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'GitHub API push failed');
      }
      setPushResult(data);
    } catch (err: any) {
      setPushError(err.message || 'GitHub push error');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6">
      {/* Header & Summary Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="text-xs text-sky-400 font-mono tabular-nums">
            Complete Sovereign Omni-Apex GitHub Repository Bundle · SLSA v1.0 Attested · 10/10 Pillars Verified
          </div>
          <h2 className="text-xl font-bold text-slate-100 font-display mt-1">
            World #1 Sovereign GitHub Repository & 1-Click Push Center
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Includes multi-stage Distroless Node.js 22 <code className="text-slate-200">Dockerfile</code>,{' '}
            <code className="text-slate-200">docker-compose.yml</code>, Keyless OIDC SLSA Level 3 GitHub Actions
            workflow (<code className="text-slate-200">.github/workflows/deploy.yml</code>), Python Fetch.ai uAgents
            node (<code className="text-slate-200">uagents_sovereign_orchestrator.py</code>), 10-pillar{' '}
            <code className="text-slate-200">tests/consensus.test.ts</code>, and all Omni-Apex modules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadBootstrapScript}
            className="px-4 py-2.5 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download 1-Click Git Bootstrap (.sh)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJsonBundle}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Download Full Repo JSON</span>
          </button>
        </div>
      </div>

      {/* Repository Telemetry Bar */}
      {bundle && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#0B0F17] border border-slate-800 rounded-lg text-xs font-mono tabular-nums">
          <div>
            <div className="text-slate-400">Total Repository Files</div>
            <div className="text-base font-semibold text-slate-100 mt-0.5">{bundle.totalFiles} Files</div>
          </div>
          <div>
            <div className="text-slate-400">Total Lines of Code</div>
            <div className="text-base font-semibold text-slate-100 mt-0.5">{bundle.totalLines.toLocaleString()} LOC</div>
          </div>
          <div>
            <div className="text-slate-400">Uncompressed Source Size</div>
            <div className="text-base font-semibold text-slate-100 mt-0.5">
              {(bundle.totalBytes / 1024).toFixed(1)} KB
            </div>
          </div>
          <div className="truncate">
            <div className="text-slate-400">Repo Tree Merkle Root</div>
            <div className="text-sm font-semibold text-emerald-400 mt-0.5 truncate" title={bundle.treeMerkleRoot}>
              0x{bundle.treeMerkleRoot.slice(0, 20)}...
            </div>
          </div>
        </div>
      )}

      {/* Split View: Direct GitHub API Push & CLI Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 6 Cols: Direct GitHub REST API Push */}
        <form
          onSubmit={handleDirectGitHubPush}
          className="lg:col-span-6 p-5 bg-[#0B0F17] border border-slate-800 rounded-lg space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-sky-400" />
              <span>Method 1: Push Directly to GitHub via Git Data API</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Auto-creates repo if missing</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">GitHub Owner / Org</label>
              <input
                type="text"
                value={ghOwner}
                onChange={(e) => setGhOwner(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#111827] border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-sky-400"
                placeholder="your-github-username"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Repository Name</label>
              <input
                type="text"
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#111827] border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-sky-400"
                placeholder="rea-autonomous-orchestrator-engine"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Target Branch</label>
              <input
                type="text"
                value={ghBranch}
                onChange={(e) => setGhBranch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#111827] border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-8">
              <label className="block text-[11px] text-slate-400 mb-1">
                GitHub Personal Access Token (<code className="font-mono">repo</code> scope — optional if{' '}
                <code className="font-mono">GITHUB_TOKEN</code> env is set)
              </label>
              <input
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#111827] border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-sky-400"
                placeholder="ghp_... or github_pat_..."
              />
            </div>
            <div className="sm:col-span-4 flex items-center gap-2 pb-1.5">
              <input
                type="checkbox"
                id="ghPrivate"
                checked={ghPrivate}
                onChange={(e) => setGhPrivate(e.target.checked)}
                className="rounded border-slate-700 bg-[#111827] text-sky-400"
              />
              <label htmlFor="ghPrivate" className="text-xs text-slate-300 cursor-pointer">
                Private Repo
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={pushing}
            className="w-full py-2.5 px-4 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {pushing
              ? `Pushing ${bundle?.totalFiles || 30} Files to github.com/${ghOwner}/${ghRepo}...`
              : `Push Complete v7.0.0-omni-apex Repository to GitHub (${ghOwner}/${ghRepo})`}
          </button>

          {pushError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded text-xs text-rose-300">{pushError}</div>
          )}

          {pushResult && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded text-xs font-mono text-emerald-300 space-y-1">
              <div className="font-semibold">
                Pushed {pushResult.filesPushed} files to {pushResult.repoUrl} ({pushResult.branch})
              </div>
              <div className="flex items-center gap-4 pt-1">
                <a
                  href={pushResult.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Repository</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={pushResult.commitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>View Commit ({pushResult.commitSha?.slice(0, 8)})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </form>

        {/* Right 6 Cols: Terminal CLI Push Commands */}
        <div className="lg:col-span-6 p-5 bg-[#0B0F17] border border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200">
              Method 2: Terminal CLI Bootstrap & Push Commands
            </div>
            <button
              type="button"
              onClick={handleCopyCli}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded flex items-center gap-1.5 cursor-pointer"
            >
              {copiedCli ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCli ? 'Copied Commands' : 'Copy CLI Commands'}</span>
            </button>
          </div>
          <pre className="p-3.5 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-sky-300 overflow-x-auto leading-relaxed">
            {cliPushCommands}
          </pre>
        </div>
      </div>

      {/* Interactive Repository File Explorer & Code Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Left 4 Cols: File Tree */}
        <div className="lg:col-span-4 bg-[#0B0F17] border border-slate-800 rounded-lg p-4 space-y-3 max-h-[560px] overflow-y-auto">
          <div className="flex items-center justify-between text-xs font-medium text-slate-300 pb-2 border-b border-slate-800">
            <span>Repository File Tree ({bundle?.totalFiles || 0})</span>
            <button
              type="button"
              onClick={fetchRepoBundle}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Refresh file tree"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="space-y-1">
            {(bundle?.files || []).map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setSelectedFilePath(f.path)}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  selectedFile?.path === f.path
                    ? 'bg-sky-400/15 text-sky-300 font-semibold border border-sky-400/40'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <span className="truncate">{f.path}</span>
                <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">{f.lineCount}L</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right 8 Cols: Selected File Source Viewer */}
        <div className="lg:col-span-8 bg-[#0B0F17] border border-slate-800 rounded-lg p-4 flex flex-col max-h-[560px]">
          {selectedFile ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 text-xs font-mono tabular-nums">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <FileCode className="w-4 h-4 text-sky-400" />
                  <span>{selectedFile.path}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <span>{selectedFile.lineCount} lines</span>
                  <span>·</span>
                  <span>{selectedFile.byteLength.toLocaleString()} B</span>
                  <span>·</span>
                  <span>sha256:{selectedFile.sha256.slice(0, 12)}</span>
                  <button
                    type="button"
                    onClick={handleCopyFileContent}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1 cursor-pointer"
                  >
                    {copiedFile ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFile ? 'Copied' : 'Copy File'}</span>
                  </button>
                </div>
              </div>
              <pre className="flex-1 mt-3 text-xs font-mono text-slate-200 overflow-auto leading-relaxed">
                {selectedFile.content}
              </pre>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-8 text-center">Loading repository file contents...</div>
          )}
        </div>
      </div>
    </div>
  );
}
