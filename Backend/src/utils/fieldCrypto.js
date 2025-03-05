import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = 'enc:v1:';
const KEY_ID = /^[A-Za-z0-9_-]{1,32}$/;
const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

export class EncryptionError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'EncryptionError';
  }
}

/**
 * Parses `DATA_ENCRYPTION_KEYS` ("keyId:base64key,keyId:base64key") and the id of the key used for writes.
 * Throws an EncryptionError that lists every problem found.
 */
export function parseKeyRing({ keys, activeKeyId }) {
  const problems = [];
  const ring = new Map();
  for (const entry of String(keys ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const separator = entry.indexOf(':');
    const id = separator < 0 ? '' : entry.slice(0, separator);
    const material = separator < 0 ? '' : entry.slice(separator + 1);
    if (!KEY_ID.test(id)) {
      problems.push(
        'every entry must look like keyId:base64key, with a keyId of 1-32 letters, digits, "_" or "-"',
      );
    } else if (ring.has(id)) {
      problems.push(`key id "${id}" is listed twice`);
    } else if (!BASE64.test(material) || Buffer.from(material, 'base64').length !== KEY_BYTES) {
      problems.push(
        `key "${id}" must be base64 encoding of exactly ${KEY_BYTES} bytes (openssl rand -base64 32)`,
      );
    } else {
      ring.set(id, Buffer.from(material, 'base64'));
    }
  }
  if (ring.size === 0 && problems.length === 0) problems.push('at least one key is required');
  if (!activeKeyId) problems.push('DATA_ENCRYPTION_ACTIVE_KEY_ID is required');
  else if (ring.size > 0 && !ring.has(activeKeyId))
    problems.push(`DATA_ENCRYPTION_ACTIVE_KEY_ID "${activeKeyId}" is not in DATA_ENCRYPTION_KEYS`);
  if (problems.length > 0) throw new EncryptionError(problems.join('; '));
  return { keys: ring, activeKeyId };
}

/** Reads the key ring from an environment object; used by scripts that do not load the full config. */
export const keyRingFromEnv = (env = process.env) =>
  parseKeyRing({ keys: env.DATA_ENCRYPTION_KEYS, activeKeyId: env.DATA_ENCRYPTION_ACTIVE_KEY_ID });

export const generateKeyEntry = (keyId) => `${keyId}:${randomBytes(KEY_BYTES).toString('base64')}`;

const b64 = (buffer) => buffer.toString('base64url');
const aad = (keyId) => Buffer.from(`v1:${keyId}`);

/**
 * AES-256-GCM field encryption. A value is stored as `enc:v1:<keyId>:<iv>:<tag>:<data>` (base64url parts),
 * so it carries everything needed to pick the right key and verify integrity. The key id is bound into the
 * authentication tag. `onFailure` is told about every failed decryption before the error is thrown.
 */
export function createFieldCipher({ keys, activeKeyId }, { onFailure } = {}) {
  const fail = (message, details, cause) => {
    onFailure?.({ ...details, message });
    throw new EncryptionError(message, cause ? { cause } : undefined);
  };

  const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

  function keyIdOf(token) {
    const keyId = isEncrypted(token) ? token.slice(PREFIX.length).split(':')[0] : undefined;
    if (!keyId) fail('value is not encrypted data', {});
    return keyId;
  }

  function encrypt(plaintext) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, keys.get(activeKeyId), iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(aad(activeKeyId));
    const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    return `${PREFIX}${activeKeyId}:${b64(iv)}:${b64(cipher.getAuthTag())}:${b64(data)}`;
  }

  function decrypt(token) {
    const parts = isEncrypted(token) ? token.slice(PREFIX.length).split(':') : [];
    if (parts.length !== 4) fail('stored value is not valid v1 ciphertext', {});
    const [keyId, iv, tag, data] = parts;
    const key = keys.get(keyId);
    if (!key) fail(`stored value was encrypted with unknown key id "${keyId}"`, { keyId });
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'), {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(aad(keyId));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString(
        'utf8',
      );
    } catch (err) {
      return fail('stored value failed authentication (tampered or corrupted)', { keyId }, err);
    }
  }

  return { activeKeyId, isEncrypted, keyIdOf, encrypt, decrypt };
}

let installed = null;

/** The process-wide cipher used by the Mongoose field types; installed once at start-up. */
export function installFieldCipher(cipher) {
  installed = cipher;
}

export function fieldCipher() {
  if (!installed) throw new EncryptionError('field encryption is not configured');
  return installed;
}
