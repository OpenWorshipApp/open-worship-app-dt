import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Legacy constants for backward-compatible decryption
const LEGACY_ALGORITHM = 'aes-256-cbc';
const LEGACY_IV_STRING = '6ce2b3237d3d6690';

const cryptoUtils = {
    encrypt(text: string, key: string) {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        const encrypted = Buffer.concat([
            cipher.update(text, 'utf8'),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();
        // Format: base64(iv + authTag + ciphertext)
        const combined = Buffer.concat([iv, authTag, encrypted]);
        return combined.toString('base64');
    },
    decrypt(text: string, key: string) {
        const data = Buffer.from(text, 'base64');
        // New GCM format: iv (16) + authTag (16) + ciphertext
        if (data.length >= IV_LENGTH + AUTH_TAG_LENGTH) {
            try {
                const iv = data.subarray(0, IV_LENGTH);
                const authTag = data.subarray(
                    IV_LENGTH,
                    IV_LENGTH + AUTH_TAG_LENGTH,
                );
                const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
                const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
                    authTagLength: AUTH_TAG_LENGTH,
                });
                decipher.setAuthTag(authTag);
                const decrypted = Buffer.concat([
                    decipher.update(encrypted),
                    decipher.final(),
                ]);
                return decrypted.toString('utf8');
            } catch (_error) {
                // Fall through to legacy decryption
            }
        }
        // Legacy CBC decryption for existing encrypted data
        const decipher = crypto.createDecipheriv(
            LEGACY_ALGORITHM,
            key,
            LEGACY_IV_STRING,
        );
        const decrypted = Buffer.concat([
            decipher.update(data),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    },
    createHash(algorithm: string) {
        return crypto.createHash(algorithm);
    },
};

export default cryptoUtils;
