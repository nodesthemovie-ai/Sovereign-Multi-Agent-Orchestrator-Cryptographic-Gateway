import { verifyPatchInSandbox } from './evolutionService.js';
import { VIKUNJA_CORS_UNIFIED_DIFF } from '../routes/radarRubricRouter.js';

export class PatchVerificationService {
  public static async verifyDiff(unifiedDiff: string = VIKUNJA_CORS_UNIFIED_DIFF) {
    const clean = await verifyPatchInSandbox(unifiedDiff);
    return {
      targetId: 'target-vikunja-11',
      ghsaId: 'GHSA-vx5x-727q-9979',
      sandboxEvaluated: true,
      gitApplyClean: clean,
      unifiedDiff,
    };
  }
}
