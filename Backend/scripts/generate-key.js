/* Prints a new data-encryption key entry for DATA_ENCRYPTION_KEYS.
 * Usage: npm run generate-key [-- <keyId>]   (default key id: k<year><month>, e.g. k202611) */
import { generateKeyEntry } from '../src/utils/fieldCrypto.js';

const now = new Date();
const keyId = process.argv[2] ?? `k${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
const entry = generateKeyEntry(keyId);

console.log(entry);
console.error(
  `\nAdd it to DATA_ENCRYPTION_KEYS (comma-separated, keep older entries so existing data stays readable)\n` +
    `and set DATA_ENCRYPTION_ACTIVE_KEY_ID=${keyId} to write new data with it. Store it in a secret manager; never commit it.`,
);
