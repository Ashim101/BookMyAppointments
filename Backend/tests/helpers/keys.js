import { generateKeyEntry } from '../../src/utils/fieldCrypto.js';

/** Random data-encryption keys, generated per call so no key ever lives in the repository. */
export function encryptionEnv(activeKeyId = 'test1', ...otherKeyIds) {
  return {
    DATA_ENCRYPTION_KEYS: [activeKeyId, ...otherKeyIds].map(generateKeyEntry).join(','),
    DATA_ENCRYPTION_ACTIVE_KEY_ID: activeKeyId,
  };
}

/** A complete, valid production environment for config tests; never used to open a database. */
export const razorpayEnv = {
  PAYMENTS_MODE: 'razorpay',
  RAZORPAY_KEY_ID: 'rzp_test_key',
  RAZORPAY_KEY_SECRET: 'test-key-secret',
  RAZORPAY_WEBHOOK_SECRET: 'test-webhook-secret',
};
