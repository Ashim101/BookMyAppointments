import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer;

/**
 * Provides the test database URI. MONGODB_URI_TEST (for example a local
 * mongo:7 container) wins; otherwise an in-memory server is started.
 */
export async function setup({ provide }) {
  if (process.env.MONGODB_URI_TEST) {
    provide('mongoUri', process.env.MONGODB_URI_TEST);
    return;
  }
  memoryServer = await MongoMemoryServer.create();
  provide('mongoUri', memoryServer.getUri());
}

export async function teardown() {
  await memoryServer?.stop();
}
