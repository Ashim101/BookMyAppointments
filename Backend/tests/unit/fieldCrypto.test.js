import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  EncryptionError,
  createFieldCipher,
  generateKeyEntry,
  keyRingFromEnv,
  parseKeyRing,
} from '../../src/utils/fieldCrypto.js';
import { encryptionEnv } from '../helpers/keys.js';

const ring = (active, ...ids) => {
  const env = encryptionEnv(active, ...ids);
  return parseKeyRing({ keys: env.DATA_ENCRYPTION_KEYS, activeKeyId: env.DATA_ENCRYPTION_ACTIVE_KEY_ID });
};
const cipherFor = (active = 'a', options) => createFieldCipher(ring(active), options);
const parts = (token) => token.split(':');

describe('field cipher', () => {
  it('round-trips text, unicode and long values', () => {
    const cipher = cipherFor();
    for (const text of ['x', 'Persistent cough since March', 'नमस्ते 🩺 – ünïcode', 'a'.repeat(5000)]) {
      expect(cipher.decrypt(cipher.encrypt(text))).toBe(text);
    }
  });

  it('writes self-describing enc:v1 tokens with a 12-byte IV and a 16-byte tag', () => {
    const cipher = cipherFor('main');
    const [scheme, version, keyId, iv, tag, data] = parts(cipher.encrypt('secret'));
    expect([scheme, version, keyId]).toEqual(['enc', 'v1', 'main']);
    expect(Buffer.from(iv, 'base64url')).toHaveLength(12);
    expect(Buffer.from(tag, 'base64url')).toHaveLength(16);
    expect(Buffer.from(data, 'base64url').toString()).not.toContain('secret');
  });

  it('uses a fresh IV for every call, so equal plaintexts give different ciphertexts', () => {
    const cipher = cipherFor();
    const tokens = Array.from({ length: 200 }, () => cipher.encrypt('same text'));
    expect(new Set(tokens).size).toBe(200);
    expect(new Set(tokens.map((token) => parts(token)[3])).size).toBe(200);
  });

  it.each([
    ['ciphertext', 5],
    ['auth tag', 4],
    ['IV', 3],
  ])('detects a tampered %s', (_name, index) => {
    const failures = [];
    const cipher = cipherFor('a', { onFailure: (details) => failures.push(details) });
    const token = parts(cipher.encrypt('take two tablets daily'));
    const bytes = Buffer.from(token[index], 'base64url');
    bytes[0] ^= 1;
    token[index] = bytes.toString('base64url');
    expect(() => cipher.decrypt(token.join(':'))).toThrow(/failed authentication/);
    expect(failures).toEqual([{ keyId: 'a', message: expect.stringMatching(/tampered/) }]);
  });

  it('detects a truncated tag and rejects malformed or plaintext values', () => {
    const cipher = cipherFor();
    const token = parts(cipher.encrypt('x'));
    token[4] = token[4].slice(0, 8);
    expect(() => cipher.decrypt(token.join(':'))).toThrow(EncryptionError);
    for (const bad of ['plain text', 'enc:v1:a:onlythree:parts', 'enc:v2:a:i:t:d', '', null, undefined, 42]) {
      expect(() => cipher.decrypt(bad)).toThrow(/not valid v1 ciphertext/);
    }
  });

  it('refuses a token whose key id was swapped for another key, and reports an unknown key id', () => {
    const env = encryptionEnv('a', 'b');
    const both = createFieldCipher(parseKeyRing({ keys: env.DATA_ENCRYPTION_KEYS, activeKeyId: 'a' }));
    const token = parts(both.encrypt('hello'));
    token[2] = 'b';
    expect(() => both.decrypt(token.join(':'))).toThrow(/failed authentication/);
    token[2] = 'zzz';
    expect(() => both.decrypt(token.join(':'))).toThrow(/unknown key id "zzz"/);
  });

  it('cannot decrypt data written under a different key ring, and reports it through onFailure', () => {
    const onFailure = vi.fn();
    const writer = cipherFor('a');
    const reader = cipherFor('a', { onFailure });
    expect(() => reader.decrypt(writer.encrypt('hello'))).toThrow(/failed authentication/);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('writes with the active key and still reads values written under older keys', () => {
    const oldKey = generateKeyEntry('2025');
    const newKey = generateKeyEntry('2026');
    const before = createFieldCipher(parseKeyRing({ keys: oldKey, activeKeyId: '2025' }));
    const after = createFieldCipher(parseKeyRing({ keys: `${oldKey},${newKey}`, activeKeyId: '2026' }));
    const legacy = before.encrypt('old record');
    expect(after.keyIdOf(legacy)).toBe('2025');
    expect(after.decrypt(legacy)).toBe('old record');
    expect(after.keyIdOf(after.encrypt('new record'))).toBe('2026');
    expect(after.activeKeyId).toBe('2026');
  });

  it('recognises encrypted values', () => {
    const cipher = cipherFor();
    expect(cipher.isEncrypted(cipher.encrypt('x'))).toBe(true);
    expect(cipher.isEncrypted('Routine check-up')).toBe(false);
    expect(cipher.isEncrypted(['enc:v1:'])).toBe(false);
    expect(() => cipher.keyIdOf('Routine check-up')).toThrow(EncryptionError);
  });
});

describe('key ring parsing', () => {
  const key = () => randomBytes(32).toString('base64');

  it('accepts standard and url-safe base64 with whitespace around entries', () => {
    const material = randomBytes(32);
    const parsed = parseKeyRing({
      keys: ` a:${material.toString('base64')} , b:${material.toString('base64url')} `,
      activeKeyId: 'b',
    });
    expect(parsed.keys.get('a').equals(material)).toBe(true);
    expect(parsed.keys.get('b').equals(material)).toBe(true);
  });

  it.each([
    ['no keys', { keys: '', activeKeyId: 'a' }, /at least one key is required/],
    ['no active id', { keys: `a:${key()}`, activeKeyId: '' }, /DATA_ENCRYPTION_ACTIVE_KEY_ID is required/],
    ['an unknown active id', { keys: `a:${key()}`, activeKeyId: 'b' }, /"b" is not in/],
    [
      'a 16-byte key',
      { keys: `a:${randomBytes(16).toString('base64')}`, activeKeyId: 'a' },
      /exactly 32 bytes/,
    ],
    [
      'a 33-byte key',
      { keys: `a:${randomBytes(33).toString('base64')}`, activeKeyId: 'a' },
      /exactly 32 bytes/,
    ],
    ['a key id with a colon', { keys: `a:b:${key()}`, activeKeyId: 'a' }, /key "a" must be base64/],
    [
      'a key id that is too long',
      { keys: `${'k'.repeat(33)}:${key()}`, activeKeyId: 'a' },
      /keyId:base64key/,
    ],
  ])('rejects %s', (_name, input, message) => {
    expect(() => parseKeyRing(input)).toThrow(message);
  });

  it('never echoes key material in an error message', () => {
    const material = randomBytes(16).toString('base64');
    expect(() => parseKeyRing({ keys: `a:${material}`, activeKeyId: 'a' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(material) }),
    );
  });

  it('reads the ring from an environment object', () => {
    const env = encryptionEnv('only');
    expect(keyRingFromEnv(env).activeKeyId).toBe('only');
    expect(() => keyRingFromEnv({})).toThrow(EncryptionError);
  });

  it('generates entries that parse back to a 32-byte key', () => {
    const entry = generateKeyEntry('fresh');
    expect(entry).toMatch(/^fresh:[A-Za-z0-9+/]{43}=$/);
    expect(parseKeyRing({ keys: entry, activeKeyId: 'fresh' }).keys.get('fresh')).toHaveLength(32);
    expect(generateKeyEntry('fresh')).not.toBe(entry);
  });
});
