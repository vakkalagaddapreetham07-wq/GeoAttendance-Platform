const crypto = require('crypto');

const RAW_KEY = process.env.BIOMETRIC_ENCRYPTION_KEY || 'biometric-super-secret-salt-key-2026';
const DERIVED_KEY = crypto.scryptSync(RAW_KEY, 'biometric_template_salt_v1', 32);

/**
 * Encrypts a float array embedding using AES-256-GCM.
 * @param {Array<number>} embeddingArray - e.g. 128 or 512 float values
 * @returns {object} { iv, ciphertext, authTag, dimension, algorithm }
 */
function encryptEmbedding(embeddingArray) {
  if (!Array.isArray(embeddingArray) || embeddingArray.length === 0) {
    throw new Error('Invalid embedding vector for encryption.');
  }

  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv);
  
  const serialized = JSON.stringify(embeddingArray);
  let ciphertext = cipher.update(serialized, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    ciphertext,
    authTag,
    dimension: embeddingArray.length,
    algorithm: 'aes-256-gcm'
  };
}

/**
 * Decrypts an encrypted embedding object back to float array.
 * @param {object} protectedObj - { iv, ciphertext, authTag }
 * @returns {Array<number>}
 */
function decryptEmbedding(protectedObj) {
  if (!protectedObj || !protectedObj.iv || !protectedObj.ciphertext || !protectedObj.authTag) {
    throw new Error('Malformed protected embedding payload.');
  }

  const iv = Buffer.from(protectedObj.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', DERIVED_KEY, iv);
  decipher.setAuthTag(Buffer.from(protectedObj.authTag, 'hex'));

  let decrypted = decipher.update(protectedObj.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

module.exports = {
  encryptEmbedding,
  decryptEmbedding
};
