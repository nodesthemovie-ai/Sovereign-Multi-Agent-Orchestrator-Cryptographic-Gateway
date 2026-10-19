export interface DaivBinaryInput {
  cycleId: number;
  driftBps: number;
  memorySliceBytes: number;
  swarmIqScaled: number;
  cep3Score: number;
  latencyUs: number;
  containmentFlags: number;
}

function crc32(bytes: Uint8Array, len: number): number {
  let c = 0xffffffff;
  for (let i = 0; i < len; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function serializeDaivBinary(input: DaivBinaryInput): Buffer {
  const ab = new ArrayBuffer(128);
  const u8 = new Uint8Array(ab);
  const dv = new DataView(ab);

  const nowMs = BigInt(Date.now());
  const boundedMem = Math.min(65536, Math.max(4096, Math.floor(input.memorySliceBytes || 32768)));

  // Cache Line 0 (0x00..0x3F)
  dv.setBigUint64(0x00, (nowMs << 16n) | 0x7000n, false);
  dv.setBigUint64(0x08, 0x8000000000000000n | BigInt(input.cycleId & 0xffffffff), false);
  dv.setBigUint64(0x10, nowMs * 1_000_000n, false);
  for (let i = 0; i < 32; i++) {
    u8[0x18 + i] = ((input.cycleId + i * 19 + boundedMem) & 0xff) ^ 0x5a;
  }
  dv.setBigUint64(0x38, 342_895_793_255n, false);

  // Cache Line 1 (0x40..0x7F)
  for (let i = 0; i < 32; i++) {
    u8[0x40 + i] = ((input.swarmIqScaled + i * 29) & 0xff) ^ 0xa5;
  }
  dv.setUint32(0x60, input.cycleId >>> 0, false);
  dv.setUint32(0x64, Math.max(0, input.driftBps) >>> 0, false);
  dv.setUint32(0x68, boundedMem >>> 0, false);
  dv.setUint32(0x6c, input.swarmIqScaled >>> 0, false);
  dv.setFloat32(0x70, input.cep3Score, false);
  dv.setUint32(0x74, input.latencyUs >>> 0, false);
  dv.setUint32(0x78, input.containmentFlags >>> 0, false);
  dv.setUint32(0x7c, crc32(u8, 0x7c), false);

  return Buffer.from(ab);
}
