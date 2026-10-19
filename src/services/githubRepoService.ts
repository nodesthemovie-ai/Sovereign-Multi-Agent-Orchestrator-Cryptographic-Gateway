import { readdir, readFile, stat } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';

export interface RepoFileEntry {
  path: string;
  byteLength: number;
  lineCount: number;
  sha256: string;
  content: string;
}

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.aistudio']);
const IGNORED_FILES = new Set(['package-lock.json', '.env']);

async function walkDirectory(rootDir: string, currentDir: string, out: RepoFileEntry[]) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name) || IGNORED_FILES.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      await walkDirectory(rootDir, fullPath, out);
    } else if (entry.isFile()) {
      const fileStat = await stat(fullPath);
      if (fileStat.size > 512_000) continue; // skip oversized binary artifacts
      const content = await readFile(fullPath, 'utf8');
      const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
      const lineCount = content.split('\n').length;
      out.push({
        path: relPath,
        byteLength: Buffer.byteLength(content, 'utf8'),
        lineCount,
        sha256,
        content,
      });
    }
  }
}

export async function collectFullGitHubRepoBundle(rootDir: string) {
  const files: RepoFileEntry[] = [];
  await walkDirectory(rootDir, rootDir, files);
  files.sort((a, b) => a.path.localeCompare(b.path));

  const totalBytes = files.reduce((acc, f) => acc + f.byteLength, 0);
  const totalLines = files.reduce((acc, f) => acc + f.lineCount, 0);
  const treeMerkleRoot = createHash('sha256')
    .update(files.map((f) => `${f.path}:${f.sha256}`).join('|'))
    .digest('hex');

  return {
    repositorySlug: 'rea-autonomous-orchestrator-engine',
    version: '7.0.0-omni-apex',
    totalFiles: files.length,
    totalBytes,
    totalLines,
    treeMerkleRoot,
    generatedAt: new Date().toISOString(),
    files,
  };
}

export function buildSelfExtractingGitScript(
  files: RepoFileEntry[],
  repoOwner = 'autocorp-sovereign',
  repoName = 'rea-autonomous-orchestrator-engine'
): string {
  const lines: string[] = [
    '#!/usr/bin/env bash',
    '# =============================================================================',
    `# Sovereign Omni-Apex (v7.0.0-omni-apex) — Self-Extracting GitHub Repo Builder`,
    `# Target Repository: https://github.com/${repoOwner}/${repoName}`,
    '# =============================================================================',
    'set -euo pipefail',
    '',
    `REPO_DIR="\${1:-${repoName}}"`,
    'mkdir -p "$REPO_DIR"',
    'cd "$REPO_DIR"',
    'echo "[1/4] Extracting Sovereign Omni-Apex repository files into $(pwd)..."',
    '',
  ];

  for (const file of files) {
    const dirName = path.posix.dirname(file.path);
    if (dirName && dirName !== '.') {
      lines.push(`mkdir -p "${dirName}"`);
    }
    const b64 = Buffer.from(file.content, 'utf8').toString('base64');
    lines.push(`echo "${b64}" | base64 -d > "${file.path}"`);
  }

  lines.push(
    '',
    'chmod +x verification.poc.sh 2>/dev/null || true',
    'echo "[2/4] Initializing Git repository on branch main..."',
    'git init -b main 2>/dev/null || (git init && git branch -M main)',
    'git add .',
    'git commit -m "feat(omni-apex): release rea-autonomous-orchestrator-engine v7.0.0-omni-apex (10/10 pillars verified)" || true',
    'echo "[3/4] Repository initialized! Total files committed: ' + files.length + '"',
    'echo "[4/4] To push to GitHub, run:"',
    `echo "  git remote add origin https://github.com/${repoOwner}/${repoName}.git"`,
    'echo "  git push -u origin main"',
    ''
  );

  return lines.join('\n');
}

export async function pushRepositoryToGitHubApi(params: {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  commitMessage?: string;
  createRepoIfMissing?: boolean;
  isPrivate?: boolean;
  files: RepoFileEntry[];
}) {
  const {
    token,
    owner,
    repo,
    branch = 'main',
    commitMessage = 'feat(omni-apex): release rea-autonomous-orchestrator-engine v7.0.0-omni-apex (10/10 pillars verified)',
    createRepoIfMissing = true,
    isPrivate = false,
    files,
  } = params;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'rea-autonomous-orchestrator-engine-v7',
  };

  // 1. Check if repo exists; if 404 and createRepoIfMissing, create it with auto_init: true
  const repoCheckRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (repoCheckRes.status === 404 && createRepoIfMissing) {
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repo,
        description:
          'Sovereign Multi-Agent Orchestrator & Cryptographic Gateway (v7.0.0-omni-apex) — Fetch.ai uAgents, 7-Ecosystem Polyglot Transceiver, HotStuff 3f+1 BFT & Depth-5 Verkle State Trie',
        private: isPrivate,
        auto_init: true,
      }),
    });
    if (!createRes.ok) {
      const errBody = await createRes.text();
      throw new Error(`Failed to create GitHub repository (${createRes.status}): ${errBody}`);
    }
    // Wait briefly for GitHub initial commit provisioning
    await new Promise((r) => setTimeout(r, 1500));
  } else if (!repoCheckRes.ok) {
    const errBody = await repoCheckRes.text();
    throw new Error(`GitHub repository access check failed (${repoCheckRes.status}): ${errBody}`);
  }

  // 2. Get current branch reference SHA (if exists)
  let baseCommitSha: string | null = null;
  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
  if (refRes.ok) {
    const refData: any = await refRes.json();
    baseCommitSha = refData?.object?.sha || null;
  }

  // 3. Create Git Tree with inline UTF-8 content for all repository files
  const treePayload: any = {
    tree: files.map((f) => ({
      path: f.path,
      mode: f.path.endsWith('.sh') ? '100755' : '100644',
      type: 'blob',
      content: f.content,
    })),
  };
  if (baseCommitSha) {
    treePayload.base_tree = baseCommitSha;
  }

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify(treePayload),
  });
  if (!treeRes.ok) {
    const errBody = await treeRes.text();
    throw new Error(`Failed to create Git tree (${treeRes.status}): ${errBody}`);
  }
  const treeData: any = await treeRes.json();

  // 4. Create Commit
  const commitPayload: any = {
    message: commitMessage,
    tree: treeData.sha,
    parents: baseCommitSha ? [baseCommitSha] : [],
  };
  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify(commitPayload),
  });
  if (!commitRes.ok) {
    const errBody = await commitRes.text();
    throw new Error(`Failed to create Git commit (${commitRes.status}): ${errBody}`);
  }
  const commitData: any = await commitRes.json();

  // 5. Update or Create Branch Ref
  if (baseCommitSha) {
    const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: commitData.sha, force: true }),
    });
    if (!updateRefRes.ok) {
      const errBody = await updateRefRes.text();
      throw new Error(`Failed to update branch ref (${updateRefRes.status}): ${errBody}`);
    }
  } else {
    const createRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commitData.sha }),
    });
    if (!createRefRes.ok) {
      const errBody = await createRefRes.text();
      throw new Error(`Failed to create branch ref (${createRefRes.status}): ${errBody}`);
    }
  }

  return {
    success: true,
    repoUrl: `https://github.com/${owner}/${repo}`,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${commitData.sha}`,
    commitSha: commitData.sha,
    treeSha: treeData.sha,
    branch,
    filesPushed: files.length,
  };
}
