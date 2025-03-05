import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { createFieldCipher, installFieldCipher, keyRingFromEnv } from '../../src/utils/fieldCrypto.js';
import { encryptionEnv } from '../helpers/keys.js';

const SEED = fileURLToPath(new URL('../../scripts/seed.js', import.meta.url));
const uri = new URL(inject('mongoUri'));
uri.pathname = `/bma_seed_test_${Date.now()}`;

describe('seed script', () => {
  const keys = encryptionEnv('seed1');
  const seed = (env) =>
    promisify(execFile)(process.execPath, [SEED, '--reset'], {
      env: { PATH: process.env.PATH, MONGODB_URI: uri.toString(), ...env },
      cwd: os.tmpdir(),
    });

  afterAll(async () => {
    const connection = await mongoose.createConnection(uri.toString()).asPromise();
    await connection.dropDatabase();
    await connection.close();
  });

  it('refuses to run without an encryption key ring', async () => {
    await expect(seed({})).rejects.toMatchObject({
      stderr: expect.stringContaining('DATA_ENCRYPTION_ACTIVE_KEY_ID'),
    });
  });

  it('writes reasons, notes and prescriptions encrypted, and they decrypt through the model', async () => {
    await seed(keys);
    const connection = await mongoose.createConnection(uri.toString()).asPromise();
    try {
      const raw = await connection.collection('appointments').find().toArray();
      const completed = raw.filter((doc) => doc.status === 'completed');
      expect(raw.length).toBeGreaterThan(20);
      expect(completed.length).toBeGreaterThan(0);
      for (const doc of raw) expect(doc.reason).toMatch(/^enc:v1:seed1:/);
      for (const doc of completed) {
        expect(doc.consultation.notes).toMatch(/^enc:v1:seed1:/);
        expect(doc.consultation.prescription).toMatch(/^enc:v1:seed1:/);
      }
      expect(JSON.stringify(raw)).not.toMatch(/Examined the patient|Routine check-up|Persistent cough/);

      await mongoose.connect(uri.toString());
      installFieldCipher(createFieldCipher(keyRingFromEnv(keys)));
      const appointment = await Appointment.findById(completed[0]._id);
      expect(appointment.consultation.notes).toBe('Examined the patient; advised rest and fluids.');
      expect(appointment.consultation.prescription.length).toBeGreaterThan(0);
    } finally {
      await connection.close();
      await mongoose.disconnect();
    }
  });
});
