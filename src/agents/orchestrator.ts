import { attestStateTransitionBftQuorum } from '../consensus/bftQuorumEngine.js';
import { generateZkConservationProof } from '../security/zkConservationProver.js';

export const executeSovereignOrchestration = (notionalUsd: number = 125000000) => {
  const bft = attestStateTransitionBftQuorum({
    ledgerHash: '0'.repeat(64),
    route: '/api/v1/execute',
    grossNotionalUsd: notionalUsd,
  });
  const zk = generateZkConservationProof(notionalUsd);
  return { bft, zk };
};
