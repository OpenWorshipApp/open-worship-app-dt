import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-cbc'; //TODO: use a secure mode
const IV_STRING = '6ce2b3237d3d6690';

const cryptoUtils = {
    encrypt(text: string, key: string) {
        const cipher = crypto.createCipheriv(ALGORITHM, key, IV_STRING);
        let encrypted = cipher.update(text);
        encrypted = Buffer.from(
            new Uint8Array([...encrypted, ...cipher.final()]),
        );
        return encrypted.toString('base64');
    },
    decrypt(text: string, key: string) {
        const encryptedText = Buffer.from(text, 'base64');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, IV_STRING);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.from(
            new Uint8Array([...decrypted, ...decipher.final()]),
        );
        return decrypted.toString();
    },
    createHash(algorithm: string) {
        return crypto.createHash(algorithm);
    },
};

export default cryptoUtils;
