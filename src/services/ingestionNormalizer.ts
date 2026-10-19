export const normalizeAdvisoryFeed = () => {
  return [
    {
      targetId: 'target-vikunja-11',
      ghsaId: 'GHSA-vx5x-727q-9979',
      ecosystem: 'Go / TypeScript',
      package: 'code.vikunja.io/api',
      severity: 'HIGH',
      summary: 'Permissive CORS Cross-Origin Data Exfiltration',
      status: 'AUDITED_AND_PATCHED',
    },
  ];
};
