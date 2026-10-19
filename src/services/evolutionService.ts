import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export const verifyPatchInSandbox = async (unifiedDiff: string): Promise<boolean> => {
  if (!unifiedDiff || typeof unifiedDiff !== 'string' || !unifiedDiff.includes('---')) {
    return false;
  }
  const patchFile = join(tmpdir(), `patch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.diff`);
  try {
    await writeFile(patchFile, unifiedDiff, 'utf8');
    await execFileAsync('git', ['apply', '--check', patchFile]);
    return true;
  } catch {
    return false;
  } finally {
    await unlink(patchFile).catch(() => {});
  }
};

export function sanitizeArchitectureSpecForReadme(rawSpec: string): string {
  return rawSpec
    .replace(/^English\s*·\s*简体中文[\s\S]*?(?=(?:#|1\.|Part I|$))/i, '')
    .trim()
    .slice(0, 32_000);
}
