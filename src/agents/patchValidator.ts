import { PatchVerificationService } from '../services/patchVerificationService.js';

export const validateSecurityPatch = async (diff?: string) => {
  return PatchVerificationService.verifyDiff(diff);
};
