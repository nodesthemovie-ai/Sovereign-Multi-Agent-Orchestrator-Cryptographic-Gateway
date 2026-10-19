import { createHash } from 'crypto';
import { logger } from '../config/env.js';
import { commitTransactionalOutbox } from '../services/dbService.js';
import { attestStateTransitionBftQuorum } from './bftQuorumEngine.js';
import { generateZkConservationProof } from '../security/zkConservationProver.js';

export type EcosystemSource =
  | 'META_MUSE'
  | 'OPENCLAW_AUTOMATION'
  | 'OPENCODE_CLI'
  | 'AGENTVERSE_FETCH'
  | 'ANTHROPIC_MCP'
  | 'LANGGRAPH_MESH'
  | 'GENERIC_MARKETPLACE';

export interface GlobalEcosystemPayload {
  ecosystemSource: EcosystemSource;
  agentId: string;
  actionIntent: string;
  grossNotionalUsd: number;
  clientMetadata?: Record<string, any>;
}

const VALID_ECOSYSTEMS: EcosystemSource[] = [
  'META_MUSE',
  'OPENCLAW_AUTOMATION',
  'OPENCODE_CLI',
  'AGENTVERSE_FETCH',
  'ANTHROPIC_MCP',
  'LANGGRAPH_MESH',
  'GENERIC_MARKETPLACE',
];

export const GlobalEcosystemPayloadSchema = {
  parse(rawBody: any): GlobalEcosystemPayload {
    if (!rawBody || !VALID_ECOSYSTEMS.includes(rawBody.ecosystemSource)) {
      throw new Error(`Invalid ecosystemSource: ${rawBody?.ecosystemSource}`);
    }
    if (typeof rawBody.agentId !== 'string' || typeof rawBody.actionIntent !== 'string') {
      throw new Error('agentId and actionIntent are required strings');
    }
    return {
      ecosystemSource: rawBody.ecosystemSource,
      agentId: rawBody.agentId,
      actionIntent: rawBody.actionIntent,
      grossNotionalUsd: Math.max(0, Number(rawBody.grossNotionalUsd ?? 125000000)),
      clientMetadata: rawBody.clientMetadata,
    };
  },
};

export class GlobalEcosystemAdapter {
  public static async normalizeAndProcess(rawBody: unknown) {
    const parsed = GlobalEcosystemPayloadSchema.parse(rawBody);

    const canonicalDigest = createHash('sha256')
      .update(`${parsed.ecosystemSource}:${parsed.agentId}:${parsed.actionIntent}:${parsed.grossNotionalUsd}`)
      .digest('hex');

    const idempotencyKey = `global_${parsed.ecosystemSource.toLowerCase()}_${canonicalDigest.slice(0, 20)}`;

    const ledgerRecord = await commitTransactionalOutbox({
      idempotencyKey,
      route: `/api/v1/global-ecosystem/${parsed.ecosystemSource.toLowerCase()}`,
      grossNotionalUsd: parsed.grossNotionalUsd,
      payload: parsed as Record<string, any>,
    });

    const bftQuorum = attestStateTransitionBftQuorum({
      ledgerHash: ledgerRecord.ledgerHash,
      route: ledgerRecord.route,
      grossNotionalUsd: parsed.grossNotionalUsd,
    });

    const zkProof = generateZkConservationProof(parsed.grossNotionalUsd);

    logger.info(
      { source: parsed.ecosystemSource, agent: parsed.agentId, quorum: bftQuorum.quorumReached },
      '[GLOBAL-ADAPTER] Harmonized multi-ecosystem platform request successfully'
    );

    return {
      success: true,
      ecosystemSource: parsed.ecosystemSource,
      ledgerId: ledgerRecord.id,
      ledgerHash: ledgerRecord.ledgerHash,
      bftQuorum,
      zkProof,
    };
  }
}
