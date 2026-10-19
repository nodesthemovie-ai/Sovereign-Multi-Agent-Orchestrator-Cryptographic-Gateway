import { containmentEngine } from '../security/rogueContainmentEngine.js';
import { generateZkConservationProof, verifyZkConservationProof } from '../security/zkConservationProver.js';
import { planetaryVerkleTrie } from '../consensus/verkleStateTrie.js';

export interface DifferentialFuzzReport {
  iterationsExecuted: number;
  invariantsHeld: boolean;
  overflowsCaughtByRing0: number;
  zkConservationPassRate: number;
  verkle152BytePassRate: number;
  durationMs: number;
}

export class AdversarialCanaryFuzzer {
  public static runDifferentialFuzzCampaign(iterations: number = 250): DifferentialFuzzReport {
    const startMs = Date.now();
    let overflowsCaught = 0;
    let zkPassed = 0;
    let verklePassed = 0;

    for (let i = 0; i < iterations; i++) {
      // 1. Fuzz conservation law across extreme financial scales ($0.01 to $999B)
      const syntheticNotional = ((i * 19_481_923) % 100_000_000_000) + 0.01;
      const zk = generateZkConservationProof(syntheticNotional);
      if (verifyZkConservationProof(zk)) zkPassed++;

      // 2. Fuzz Verkle 152-byte witness generation
      const witness = planetaryVerkleTrie.insertAndProve(`fuzz_agent_${i}`, zk.inputCommitmentHex);
      if (witness.verified && witness.witnessByteLength === 152) verklePassed++;

      // 3. Fuzz RFC-003 64KB boundary every 10th iteration
      if (i % 10 === 0) {
        const breach = containmentEngine.inspectExecutionBoundary('A'.repeat(65537), 0.25);
        if (!breach.allowed) overflowsCaught++;
      }
    }

    const expectedOverflows = Math.ceil(iterations / 10);
    const invariantsHeld =
      zkPassed === iterations &&
      verklePassed === iterations &&
      overflowsCaught === expectedOverflows;

    return {
      iterationsExecuted: iterations,
      invariantsHeld,
      overflowsCaughtByRing0: overflowsCaught,
      zkConservationPassRate: Number(((zkPassed / iterations) * 100).toFixed(2)),
      verkle152BytePassRate: Number(((verklePassed / iterations) * 100).toFixed(2)),
      durationMs: Math.max(1, Date.now() - startMs),
    };
  }
}
