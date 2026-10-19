export const initQueue = async () => {
  return;
};

export const enqueueOutboxRelayJob = async (ledgerId: string, _payload: Record<string, any>) => {
  return { id: `job_${ledgerId}`, status: 'SETTLED_DIRECT' };
};
