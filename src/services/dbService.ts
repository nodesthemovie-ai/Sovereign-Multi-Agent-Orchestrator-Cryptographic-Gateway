import { createHash, randomBytes } from 'crypto';

export interface LedgerRecord {
  id: string;
  idempotencyKey: string;
  route: string;
  status: 'QUEUED' | 'SETTLED' | 'QUARANTINED';
  grossNotionalUsd: number;
  payload: Record<string, any>;
  prevLedgerHash: string;
  ledgerHash: string;
  createdAt: Date;
}

export interface OutboxEvent {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, any>;
  dispatched: boolean;
  createdAt: Date;
}

const memoryLedger: LedgerRecord[] = [];
const memoryOutbox: OutboxEvent[] = [];

export const initDB = async () => {
  return;
};

export const commitTransactionalOutbox = async (params: {
  idempotencyKey: string;
  route: string;
  grossNotionalUsd: number;
  payload: Record<string, any>;
  status?: 'QUEUED' | 'SETTLED' | 'QUARANTINED';
}): Promise<LedgerRecord> => {
  const prevLedgerHash = memoryLedger[0]?.ledgerHash || '0'.repeat(64);
  const raw = `${prevLedgerHash}|${params.idempotencyKey}|${params.route}|${params.grossNotionalUsd}|${JSON.stringify(
    params.payload || {}
  )}`;
  const ledgerHash = createHash('sha256').update(raw).digest('hex');

  const record: LedgerRecord = {
    id: `ldg_${Date.now().toString(16)}_${randomBytes(2).toString('hex')}`,
    idempotencyKey: params.idempotencyKey,
    route: params.route,
    status: params.status || 'QUEUED',
    grossNotionalUsd: params.grossNotionalUsd,
    payload: params.payload,
    prevLedgerHash,
    ledgerHash,
    createdAt: new Date(),
  };

  memoryLedger.unshift(record);
  if (memoryLedger.length > 60) {
    memoryLedger.pop();
  }

  const outbox: OutboxEvent = {
    id: `obx_${Date.now().toString(16)}_${randomBytes(2).toString('hex')}`,
    aggregateId: record.id,
    eventType: 'SETTLEMENT_DISPATCH',
    payload: { ledgerId: record.id, ...params.payload },
    dispatched: false,
    createdAt: new Date(),
  };
  memoryOutbox.push(outbox);

  return record;
};

export const findLedgerRecordById = async (id: string): Promise<LedgerRecord | null> => {
  return memoryLedger.find((r) => r.id === id || r.idempotencyKey === id) || memoryLedger[0] || null;
};

export const markLedgerSettled = async (ledgerId: string) => {
  const found = memoryLedger.find((r) => r.id === ledgerId);
  if (found) found.status = 'SETTLED';
};

export const markOutboxDispatched = async (aggregateId: string) => {
  const found = memoryOutbox.find((o) => o.aggregateId === aggregateId);
  if (found) found.dispatched = true;
  const ledger = memoryLedger.find((r) => r.id === aggregateId);
  if (ledger && ledger.status === 'QUEUED') {
    ledger.status = 'SETTLED';
  }
};

export const sweepUndispatchedOutboxEvents = async (
  dispatchFn: (ledgerId: string, payload: Record<string, any>) => Promise<any>
): Promise<number> => {
  let swept = 0;
  for (const evt of memoryOutbox) {
    if (!evt.dispatched) {
      await dispatchFn(evt.aggregateId, evt.payload);
      evt.dispatched = true;
      await markLedgerSettled(evt.aggregateId);
      swept++;
    }
  }
  return swept;
};

export const getMemoryLedger = (): LedgerRecord[] => memoryLedger;
export const getMemoryOutbox = (): OutboxEvent[] => memoryOutbox;
