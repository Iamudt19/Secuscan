'use strict';

const crypto = require('crypto');

// Scrypt configuration (recommended production parameters)
const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost
  r: 8,     // Block size
  p: 1,     // Parallelization
};
const KEY_LEN = 64;
const SALT_LEN = 16;

/**
 * Hash a password using crypto.scryptSync.
 *
 * @param {string} password
 * @returns {string} The formatted hash string "salt:hash"
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored "salt:hash" string.
 * Uses timingSafeEqual to prevent side-channel timing attacks.
 *
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean} True if password matches, false otherwise
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) {
    return false;
  }

  const hash = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS).toString('hex');
  
  const hashBuffer = Buffer.from(hash, 'hex');
  const originalBuffer = Buffer.from(originalHash, 'hex');

  if (hashBuffer.length !== originalBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, originalBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
