import { createHash } from 'crypto';
import { logger } from '../config/env.js';
import { commitTransactionalOutbox, markOutboxDispatched } from '../services/dbService.js';
import { attestStateTransitionBftQuorum } from './bftQuorumEngine.js';
import { generateZkConservationProof } from '../security/zkConservationProver.js';

export type UniversalPlatform =
  | 'META_MUSE'
  | 'OPENCLAW'
  | 'OPENCODE'
  | 'AGENTVERSE_FETCH'
  | 'ANTHROPIC_MCP'
  | 'LANGGRAPH_CREW'
  | 'GENERIC_A2A';

export interface UniversalEcosystemEnvelope {
  platform: UniversalPlatform;
  originAgentId: string;
  intentPayload: Record<string, any>;
  declaredNotionalUsd: number;
  clientSignature?: string;
}

const VALID_PLATFORMS: UniversalPlatform[] = [
  'META_MUSE',
  'OPENCLAW',
  'OPENCODE',
  'AGENTVERSE_FETCH',
  'ANTHROPIC_MCP',
  'LANGGRAPH_CREW',
  'GENERIC_A2A',
];

export const UniversalEcosystemEnvelopeSchema = {
  parse(rawBody: any): UniversalEcosystemEnvelope {
    if (!rawBody || !VALID_PLATFORMS.includes(rawBody.platform)) {
      throw new Error(`Invalid platform: ${rawBody?.platform}`);
    }
    if (typeof rawBody.originAgentId !== 'string' || !rawBody.intentPayload || typeof rawBody.intentPayload !== 'object') {
      throw new Error('originAgentId and intentPayload are required');
    }
    return {
      platform: rawBody.platform,
      originAgentId: rawBody.originAgentId,
      intentPayload: rawBody.intentPayload,
      declaredNotionalUsd: Math.max(0, Number(rawBody.declaredNotionalUsd ?? 125000000)),
      clientSignature: rawBody.clientSignature,
    };
  },
};

export class UniversalEcosystemRouter {
  public static async routeAndNormalize(rawBody: unknown) {
    const envelope = UniversalEcosystemEnvelopeSchema.parse(rawBody);

    const canonicalDigest = createHash('sha256')
      .update(JSON.stringify(envelope))
      .digest('hex');

    const idempotencyKey = `uni_${envelope.platform.toLowerCase()}_${canonicalDigest.slice(0, 24)}`;

    const ledgerRecord = await commitTransactionalOutbox({
      idempotencyKey,
      route: `/api/v1/universal/${envelope.platform.toLowerCase()}`,
      grossNotionalUsd: envelope.declaredNotionalUsd,
      payload: envelope as Record<string, any>,
    });
    await markOutboxDispatched(ledgerRecord.id);

    const bftQuorum = attestStateTransitionBftQuorum({
      ledgerHash: ledgerRecord.ledgerHash,
      route: ledgerRecord.route,
      grossNotionalUsd: envelope.declaredNotionalUsd,
    });

    const zkProof = generateZkConservationProof(envelope.declaredNotionalUsd);

    logger.info(
      { platform: envelope.platform, agent: envelope.originAgentId, quorumReached: bftQuorum.quorumReached },
      '[UNIVERSAL-ROUTER] Harmonized external agent ecosystem request successfully'
    );

    return {
      success: true,
      platform: envelope.platform,
      normalizedLedgerId: ledgerRecord.id,
      ledgerHash: ledgerRecord.ledgerHash,
      bftQuorum,
      zkProof,
    };
  }
}
