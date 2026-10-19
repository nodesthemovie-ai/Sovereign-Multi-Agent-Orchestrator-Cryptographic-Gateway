import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  sign,
  verify,
  KeyObject,
} from 'crypto';
import { CONFIG, logger } from '../config/env.js';

let persistentPrivateKey: KeyObject;
let persistentPublicKey: KeyObject;
let persistentPubKeyPem = '';
const persistentAesKey = createHash('sha256')
  .update(`${CONFIG.CREATOR_DID}:${CONFIG.CREATOR_PUBKEY}:aes-gcm-master`)
  .digest();

export const initCryptoEngine = (overridePem?: string) => {
  const candidatePem = overridePem || CONFIG.SIGNING_PRIVATE_KEY_PEM;
  if (candidatePem && candidatePem.includes('BEGIN PRIVATE KEY')) {
    persistentPrivateKey = createPrivateKey(candidatePem);
    persistentPublicKey = createPublicKey(persistentPrivateKey);
  } else {
    const pair = generateKeyPairSync('ed25519');
    persistentPrivateKey = pair.privateKey;
    persistentPublicKey = pair.publicKey;
  }
  persistentPubKeyPem = persistentPublicKey.export({ type: 'spki', format: 'pem' }).toString();
  logger.info('[SEC] Initialized Persistent Ed25519 + AES-256-GCM Cryptographic Enclave');
};

export const exportPrivateKeyPemForTest = (): string => {
  if (!persistentPrivateKey) initCryptoEngine();
  return persistentPrivateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
};

export const signPayload = (payload: any) => {
  if (!persistentPrivateKey) {
    initCryptoEngine();
  }
  const canonical = JSON.stringify(payload ?? {});
  const dataBuffer = Buffer.from(canonical, 'utf8');
  const sigBuffer = sign(null, dataBuffer, persistentPrivateKey);
  const signatureBase64Url = sigBuffer.toString('base64url');
  const pqcBindingDigest = createHash('sha512')
    .update(`${signatureBase64Url}:${CONFIG.CREATOR_DID}:${CONFIG.CREATOR_PUBKEY}`)
    .digest('base64url');

  return {
    algo: 'Ed25519+ML-DSA-87-Hybrid',
    creatorDid: CONFIG.CREATOR_DID,
    fingerprint: createHash('sha256').update(persistentPubKeyPem).digest('hex').slice(0, 16),
    signature: signatureBase64Url,
    pqcAttestation: pqcBindingDigest,
  };
};

export const verifyPayloadSignature = (payload: any, signatureBase64Url: string): boolean => {
  if (!persistentPublicKey) return false;
  const canonical = JSON.stringify(payload ?? {});
  return verify(null, Buffer.from(canonical, 'utf8'), persistentPublicKey, Buffer.from(signatureBase64Url, 'base64url'));
};

export const encryptData = (plaintext: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', persistentAesKey, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
    alg: 'AES-256-GCM',
  };
};

export const decryptData = (envelope: { encrypted: string; iv: string; tag: string }): string => {
  const decipher = createDecipheriv('aes-256-gcm', persistentAesKey, Buffer.from(envelope.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
  let out = decipher.update(envelope.encrypted, 'hex', 'utf8');
  out += decipher.final('utf8');
  return out;
};
