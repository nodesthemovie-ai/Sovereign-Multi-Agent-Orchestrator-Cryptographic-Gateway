import { createHash } from 'crypto';
import { logger } from '../config/env.js';
import { commitTransactionalOutbox } from '../services/dbService.js';
import { attestStateTransitionBftQuorum } from './bftQuorumEngine.js';
import { generateZkConservationProof } from '../security/zkConservationProver.js';

export type ProtocolSource = 'FETCH_UAGENTS' | 'GOOGLE_A2A' | 'ANTHROPIC_MCP' | 'LANGCHAIN_GRAPH' | 'RAW_HTTP';

export interface UniversalDirective {
  protocolSource: ProtocolSource;
  senderAgentId: string;
  targetDirective: string;
  grossNotionalUsd: number;
  payloadHash?: string;
  signature?: string;
}

const VALID_SOURCES: ProtocolSource[] = [
  'FETCH_UAGENTS',
  'GOOGLE_A2A',
  'ANTHROPIC_MCP',
  'LANGCHAIN_GRAPH',
  'RAW_HTTP',
];

export const UniversalDirectiveSchema = {
  parse(rawBody: any): UniversalDirective {
    if (!rawBody || !VALID_SOURCES.includes(rawBody.protocolSource)) {
      throw new Error(`Invalid protocolSource: ${rawBody?.protocolSource}`);
    }
    if (typeof rawBody.senderAgentId !== 'string' || typeof rawBody.targetDirective !== 'string') {
      throw new Error('senderAgentId and targetDirective are required strings');
    }
    return {
      protocolSource: rawBody.protocolSource,
      senderAgentId: rawBody.senderAgentId,
      targetDirective: rawBody.targetDirective,
      grossNotionalUsd: Math.max(0, Number(rawBody.grossNotionalUsd ?? 125000000)),
      payloadHash: rawBody.payloadHash,
      signature: rawBody.signature,
    };
  },
};

export class UniversalProtocolAdapter {
  public static async ingestAndNormalize(rawBody: unknown): Promise<{
    normalizedId: string;
    bftQuorum: any;
    zkProof: any;
    ledgerHash: string;
  }> {
    const parsed = UniversalDirectiveSchema.parse(rawBody);

    const computedHash = createHash('sha256')
      .update(`${parsed.protocolSource}:${parsed.senderAgentId}:${parsed.targetDirective}:${parsed.grossNotionalUsd}`)
      .digest('hex');

    const idempotencyKey = `univ_${parsed.protocolSource.toLowerCase()}_${computedHash.slice(0, 16)}`;

    const ledgerRecord = await commitTransactionalOutbox({
      idempotencyKey,
      route: `/api/v1/bridge/${parsed.protocolSource.toLowerCase()}`,
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
      { source: parsed.protocolSource, agent: parsed.senderAgentId, quorum: bftQuorum.quorumReached },
      '[UNIVERSAL-ADAPTER] Successfully ingested and harmonized cross-platform agent directive'
    );

    return {
      normalizedId: ledgerRecord.id,
      bftQuorum,
      zkProof,
      ledgerHash: ledgerRecord.ledgerHash,
    };
  }
}
