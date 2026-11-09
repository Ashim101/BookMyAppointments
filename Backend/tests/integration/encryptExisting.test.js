import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { encryptExisting } from '../../scripts/encrypt-existing.js';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import {
  EncryptionError,
  createFieldCipher,
  generateKeyEntry,
  installFieldCipher,
  parseKeyRing,
} from '../../src/utils/fieldCrypto.js';

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL('../../scripts/encrypt-existing.js', import.meta.url));
const PRESCRIPTION = [
  { medicine: 'Amoxicillin', dosage: '500 mg', frequency: '3x', durationDays: 5, instructions: '' },
];

const KEY_2025 = generateKeyEntry('2025');
const KEY_2026 = generateKeyEntry('2026');
const cipherWith = (keys, activeKeyId) => createFieldCipher(parseKeyRing({ keys, activeKeyId }));

const oid = () => new mongoose.Types.ObjectId();
const legacy = (overrides = {}) => ({
  _id: oid(),
  patient: oid(),
  doctor: oid(),
  date: '2026-03-03',
  time: '10:00',
  status: 'completed',
  reason: 'Persistent cough',
  consultation: { notes: 'Chest clear', prescription: PRESCRIPTION, completedAt: new Date() },
  ...overrides,
});

describe('encrypt-existing migration', () => {
  let collection;
  const find = (doc) => collection.findOne({ _id: doc._id });

  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `bma_migrate_${Date.now()}` });
    collection = Appointment.collection;
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  beforeEach(() => collection.deleteMany({}));

  it('encrypts plaintext reason, notes and prescription, and leaves the model able to read them', async () => {
    const doc = legacy();
    await collection.insertOne(doc);
    const cipher = cipherWith(KEY_2026, '2026');

    expect(await encryptExisting({ collection, cipher })).toEqual({
      scanned: 1,
      encrypted: 1,
      rotated: 0,
      unchanged: 0,
    });

    const raw = await find(doc);
    expect(JSON.stringify(raw)).not.toMatch(/Persistent cough|Chest clear|Amoxicillin/);
    expect(cipher.keyIdOf(raw.reason)).toBe('2026');
    expect(cipher.decrypt(raw.consultation.notes)).toBe('Chest clear');
    expect(JSON.parse(cipher.decrypt(raw.consultation.prescription))).toEqual(PRESCRIPTION);
    // Everything else on the document is untouched.
    expect(raw).toMatchObject({ date: '2026-03-03', status: 'completed', time: '10:00' });

    installFieldCipher(cipher);
    const loaded = await Appointment.findById(doc._id);
    expect(loaded.reason).toBe('Persistent cough');
    expect(loaded.consultation.prescription).toEqual(PRESCRIPTION);
  });

  it('is idempotent: a second run changes nothing', async () => {
    await collection.insertMany([legacy(), legacy({ consultation: null, reason: '' })]);
    const cipher = cipherWith(KEY_2026, '2026');
    await encryptExisting({ collection, cipher });
    const before = await collection.find().sort({ _id: 1 }).toArray();
    expect(await encryptExisting({ collection, cipher })).toEqual({
      scanned: 2,
      encrypted: 0,
      rotated: 0,
      unchanged: 2,
    });
    expect(await collection.find().sort({ _id: 1 }).toArray()).toEqual(before);
  });

  it('skips empty values, missing consultations and appointments without any health data', async () => {
    const empty = legacy({ reason: '', consultation: null });
    const bare = legacy();
    delete bare.reason;
    delete bare.consultation;
    await collection.insertMany([empty, bare]);
    const stats = await encryptExisting({ collection, cipher: cipherWith(KEY_2026, '2026') });
    expect(stats).toMatchObject({ scanned: 2, encrypted: 0, unchanged: 2 });
    expect(await find(empty)).toEqual(empty);
  });

  it('encrypts an empty prescription list and a partly migrated document', async () => {
    const cipher = cipherWith(KEY_2026, '2026');
    const partly = legacy({ reason: cipher.encrypt('Already protected') });
    partly.consultation.prescription = [];
    await collection.insertOne(partly);
    expect(await encryptExisting({ collection, cipher })).toMatchObject({ encrypted: 1 });
    const raw = await find(partly);
    expect(raw.reason).toBe(partly.reason);
    expect(cipher.decrypt(raw.consultation.prescription)).toBe('[]');
  });

  describe('key rotation', () => {
    it('re-encrypts values written under a non-active key and keeps them readable', async () => {
      const oldCipher = cipherWith(KEY_2025, '2025');
      const doc = legacy({
        reason: oldCipher.encrypt('Persistent cough'),
        consultation: {
          notes: oldCipher.encrypt('Chest clear'),
          prescription: oldCipher.encrypt(JSON.stringify(PRESCRIPTION)),
        },
      });
      await collection.insertMany([doc, legacy()]);
      const rotated = cipherWith(`${KEY_2025},${KEY_2026}`, '2026');
      expect(await encryptExisting({ collection, cipher: rotated })).toEqual({
        scanned: 2,
        encrypted: 1,
        rotated: 1,
        unchanged: 0,
      });
      expect(await encryptExisting({ collection, cipher: rotated })).toMatchObject({ unchanged: 2 });

      const raw = await find(doc);
      for (const value of [raw.reason, raw.consultation.notes, raw.consultation.prescription]) {
        expect(rotated.keyIdOf(value)).toBe('2026');
      }
      expect(rotated.decrypt(raw.reason)).toBe('Persistent cough');

      // The old key is no longer needed once nothing is stored under it.
      const onlyNew = cipherWith(KEY_2026, '2026');
      expect(onlyNew.decrypt(raw.consultation.notes)).toBe('Chest clear');
    });

    it('reports exactly what moved on the rotation run', async () => {
      const oldCipher = cipherWith(KEY_2025, '2025');
      await collection.insertMany([
        legacy({ reason: oldCipher.encrypt('a'), consultation: null }),
        legacy({ reason: oldCipher.encrypt('b'), consultation: null }),
        legacy({ reason: 'plain', consultation: null }),
      ]);
      const stats = await encryptExisting({
        collection,
        cipher: cipherWith(`${KEY_2025},${KEY_2026}`, '2026'),
      });
      expect(stats).toEqual({ scanned: 3, encrypted: 1, rotated: 2, unchanged: 0 });
    });

    it('stops with an error rather than guess when a value uses a key that is not in the ring', async () => {
      const doc = legacy({ reason: cipherWith(KEY_2025, '2025').encrypt('secret') });
      await collection.insertOne(doc);
      await expect(encryptExisting({ collection, cipher: cipherWith(KEY_2026, '2026') })).rejects.toThrow(
        EncryptionError,
      );
      expect(await find(doc)).toEqual(doc);
    });

    it('stops on tampered ciphertext without writing', async () => {
      const oldCipher = cipherWith(KEY_2025, '2025');
      const token = oldCipher.encrypt('secret').split(':');
      token[5] = Buffer.from('forged').toString('base64url');
      const doc = legacy({ reason: token.join(':') });
      await collection.insertOne(doc);
      await expect(
        encryptExisting({ collection, cipher: cipherWith(`${KEY_2025},${KEY_2026}`, '2026') }),
      ).rejects.toThrow(/failed authentication/);
      expect(await find(doc)).toEqual(doc);
    });
  });

  it('does not overwrite an edit made after the document was read', async () => {
    const doc = legacy({ consultation: null });
    await collection.insertOne(doc);
    const stale = await collection.find().toArray();
    await collection.updateOne({ _id: doc._id }, { $set: { reason: 'edited meanwhile' } });
    const readsStaleSnapshot = Object.create(collection, {
      find: { value: () => stale },
    });
    await expect(
      encryptExisting({ collection: readsStaleSnapshot, cipher: cipherWith(KEY_2026, '2026') }),
    ).rejects.toThrow(/changed during migration/);
    expect((await find(doc)).reason).toBe('edited meanwhile');
  });

  describe('as a command', () => {
    const uri = new URL(inject('mongoUri'));
    const dbName = `bma_migrate_cli_${Date.now()}`;
    uri.pathname = `/${dbName}`;
    const env = (keys, active) => ({
      PATH: process.env.PATH,
      MONGODB_URI: uri.toString(),
      DATA_ENCRYPTION_KEYS: keys,
      DATA_ENCRYPTION_ACTIVE_KEY_ID: active,
    });
    const cli = (environment) => run(process.execPath, [SCRIPT], { env: environment, cwd: os.tmpdir() });

    it('encrypts, then rotates, and reports counts; exits non-zero without a key ring', async () => {
      const connection = await mongoose.createConnection(uri.toString()).asPromise();
      try {
        const rawCollection = connection.collection('appointments');
        const doc = legacy();
        await rawCollection.insertOne(doc);

        const first = await cli(env(KEY_2025, '2025'));
        expect(first.stdout).toContain('1 encrypted, 0 moved to key "2025", 0 already current');
        const second = await cli(env(`${KEY_2025},${KEY_2026}`, '2026'));
        expect(second.stdout).toContain('Scanned 1 appointments: 0 encrypted, 1 moved to key "2026"');
        const raw = await rawCollection.findOne({ _id: doc._id });
        expect(raw.reason).toMatch(/^enc:v1:2026:/);

        await expect(cli(env('', ''))).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining('Migration failed'),
        });
      } finally {
        await connection.dropDatabase();
        await connection.close();
      }
    });
  });
});
