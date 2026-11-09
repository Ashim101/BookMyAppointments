import { fieldCipher } from './fieldCrypto.js';

/**
 * Mongoose path options that encrypt on write and decrypt on read, so code that uses documents never
 * sees ciphertext and the database never sees plaintext. Empty values are stored empty.
 * These validate nothing: length limits belong to the request validators, because the stored value is longer.
 */
export const encryptedText = {
  type: String,
  default: '',
  set: (value) => (typeof value === 'string' && value !== '' ? fieldCipher().encrypt(value) : value),
  get: (value) => (typeof value === 'string' && value !== '' ? fieldCipher().decrypt(value) : value),
};

/** An array stored as one encrypted JSON string. */
export const encryptedList = {
  type: String,
  set: (value) => (Array.isArray(value) ? fieldCipher().encrypt(JSON.stringify(value)) : value),
  get: (value) => (typeof value === 'string' ? JSON.parse(fieldCipher().decrypt(value)) : []),
};
