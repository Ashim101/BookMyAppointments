import { MongoClient } from 'mongodb';
import { mongoUri } from '../scripts/stack.mjs';

/** Runs `fn(db)` against the e2e database. Used only for what the real clock cannot do (see moveAppointmentTo). */
export async function withDb(fn) {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    return await fn(client.db());
  } finally {
    await client.close();
  }
}
