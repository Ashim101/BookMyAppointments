/* Encrypts health data that is still plaintext and re-encrypts values written under a key that is not the
 * active one (key rotation). Idempotent: values already under the active key are left alone.
 * Usage: npm run encrypt-existing
 * Needs MONGODB_URI, DATA_ENCRYPTION_KEYS and DATA_ENCRYPTION_ACTIVE_KEY_ID. Back up the database first. */
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Appointment } from '../src/modules/appointments/appointment.model.js';
import { createFieldCipher, keyRingFromEnv } from '../src/utils/fieldCrypto.js';

const TEXT_FIELDS = ['reason', 'consultation.notes'];
const LIST_FIELD = 'consultation.prescription';

const read = (doc, path) => path.split('.').reduce((value, key) => value?.[key], doc);

/**
 * Works on the raw collection: the model's own getters would refuse the plaintext this has to handle.
 * Returns how many documents were scanned, encrypted from plaintext, rotated to the active key and left alone.
 */
export async function encryptExisting({ collection, cipher }) {
  const stats = { scanned: 0, encrypted: 0, rotated: 0, unchanged: 0 };

  /** The value to store for `path`, or undefined when it is already under the active key. */
  function reencrypt(value, isList) {
    if (cipher.isEncrypted(value)) {
      if (cipher.keyIdOf(value) === cipher.activeKeyId) return undefined;
      return { value: cipher.encrypt(cipher.decrypt(value)), kind: 'rotated' };
    }
    if (isList ? !Array.isArray(value) : typeof value !== 'string' || value === '') return undefined;
    return { value: cipher.encrypt(isList ? JSON.stringify(value) : value), kind: 'encrypted' };
  }

  for await (const doc of collection.find({}, { projection: { reason: 1, consultation: 1 } })) {
    stats.scanned += 1;
    const filter = { _id: doc._id };
    const set = {};
    const kinds = new Set();
    for (const path of [...TEXT_FIELDS, LIST_FIELD]) {
      const current = read(doc, path);
      const next = (current ?? undefined) === undefined ? undefined : reencrypt(current, path === LIST_FIELD);
      if (!next) continue;
      // Only overwrite what was read, so a concurrent edit is never clobbered with a stale value.
      filter[path] = current;
      set[path] = next.value;
      kinds.add(next.kind);
    }
    if (kinds.size === 0) {
      stats.unchanged += 1;
      continue;
    }
    const { modifiedCount } = await collection.updateOne(filter, { $set: set });
    if (modifiedCount === 0) throw new Error(`appointment ${doc._id} changed during migration; run it again`);
    stats[kinds.has('encrypted') ? 'encrypted' : 'rotated'] += 1;
  }
  return stats;
}

async function main() {
  dotenv.config({ quiet: true });
  const cipher = createFieldCipher(keyRingFromEnv());
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bookmyappointments', {
    serverSelectionTimeoutMS: 10_000,
  });
  const stats = await encryptExisting({ collection: Appointment.collection, cipher });
  console.log(
    `Scanned ${stats.scanned} appointments: ${stats.encrypted} encrypted, ${stats.rotated} moved to key ` +
      `"${cipher.activeKeyId}", ${stats.unchanged} already current.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
