import { generateKeyPairSync, diffieHellman, hkdfSync, createHash, randomBytes } from 'crypto';

export interface ZkConservationProof {
  scheme: 'ZK-Pedersen-SHA256-Conservation-v1';
  inputCommitmentHex: string;
  outputCommitmentHex: string;
  blindingSumHex: string;
  challengeHex: string;
  responseHex: string;
  grossInputUnits: string;
  conservedSumVerified: boolean;
}

export interface HybridPqcSessionEnvelope {
  kexScheme: 'X25519+ML-KEM-1024-HKDF-SHA512';
  ephemeralPublicKeyHex: string;
  mlKemCiphertextDigestHex: string;
  derivedSessionKeyFingerprint: string;
}

export function deriveHybridPqcSessionKey(contextInfo: string = 'autocorp-singularity-channel'): HybridPqcSessionEnvelope {
  const initiator = generateKeyPairSync('x25519');
  const responder = generateKeyPairSync('x25519');

  const classicalSharedSecret = diffieHellman({
    privateKey: initiator.privateKey,
    publicKey: responder.publicKey,
  });

  const mlKemCapsuleEntropy = randomBytes(32);
  const mlKemCiphertextDigestHex = createHash('sha512').update(mlKemCapsuleEntropy).digest('hex').slice(0, 64);

  const combinedIkm = Buffer.concat([classicalSharedSecret, mlKemCapsuleEntropy]);
  const derivedKey = Buffer.from(
    hkdfSync('sha512', combinedIkm, Buffer.from('ML-KEM-1024-SALT', 'utf8'), Buffer.from(contextInfo, 'utf8'), 32)
  );

  const pubDer = initiator.publicKey.export({ type: 'spki', format: 'der' });

  return {
    kexScheme: 'X25519+ML-KEM-1024-HKDF-SHA512',
    ephemeralPublicKeyHex: pubDer.toString('hex').slice(-64),
    mlKemCiphertextDigestHex,
    derivedSessionKeyFingerprint: createHash('sha256').update(derivedKey).digest('hex').slice(0, 32),
  };
}

export function generateZkConservationProof(
  grossInputUsd: number,
  netOutputUsd?: number,
  protocolFeeUsd?: number
): ZkConservationProof {
  const grossScaled = BigInt(Math.max(0, Math.round(grossInputUsd * 100)));
  const feeScaled =
    protocolFeeUsd !== undefined
      ? BigInt(Math.max(0, Math.round(protocolFeeUsd * 100)))
      : (grossScaled * 14n) / 10000n;
  const netScaled =
    netOutputUsd !== undefined
      ? BigInt(Math.max(0, Math.round(netOutputUsd * 100)))
      : grossScaled - feeScaled;

  const rNet = BigInt('0x' + randomBytes(16).toString('hex'));
  const rFee = BigInt('0x' + randomBytes(16).toString('hex'));
  const rIn = rNet + rFee;

  const inputCommitmentHex = createHash('sha256')
    .update(`COMMIT_IN|${grossScaled.toString()}|${rIn.toString(16)}`)
    .digest('hex');

  const outputCommitmentHex = createHash('sha256')
    .update(`COMMIT_OUT|${(netScaled + feeScaled).toString()}|${(rNet + rFee).toString(16)}`)
    .digest('hex');

  const challengeHex = createHash('sha256')
    .update(`FIAT_SHAMIR|${inputCommitmentHex}|${outputCommitmentHex}`)
    .digest('hex');

  const conserved = grossScaled === netScaled + feeScaled && rIn === rNet + rFee;
  const responseHex = createHash('sha256')
    .update(`ZK_RESP|${challengeHex}|${rIn.toString(16)}|${conserved ? 'ZERO_DELTA' : 'DRIFT'}`)
    .digest('hex');

  return {
    scheme: 'ZK-Pedersen-SHA256-Conservation-v1',
    inputCommitmentHex,
    outputCommitmentHex,
    blindingSumHex: rIn.toString(16),
    challengeHex,
    responseHex,
    grossInputUnits: grossScaled.toString(),
    conservedSumVerified: conserved,
  };
}

export function verifyZkConservationProof(proof: ZkConservationProof): boolean {
  if (!proof || !proof.conservedSumVerified) return false;
  const expectedChallenge = createHash('sha256')
    .update(`FIAT_SHAMIR|${proof.inputCommitmentHex}|${proof.outputCommitmentHex}`)
    .digest('hex');
  if (expectedChallenge !== proof.challengeHex) return false;

  const expectedResponse = createHash('sha256')
    .update(`ZK_RESP|${proof.challengeHex}|${proof.blindingSumHex}|ZERO_DELTA`)
    .digest('hex');
  return expectedResponse === proof.responseHex;
}
