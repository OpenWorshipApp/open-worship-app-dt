import { app, safeStorage } from 'electron';

/**
 * Credentials (AI API keys, CCLI SongSelect client secret/subscription
 * key/tokens) used to be written in cleartext into `setting.json`. They now go
 * through `safeStorage`, which encrypts with a key held by the OS for the
 * current user (Windows DPAPI, macOS Keychain, Linux libsecret/kwallet).
 *
 * What this does and does not buy, so nobody over-claims it: the app runs with
 * `contextIsolation: false` and `nodeIntegration: true`, so any code running in
 * a renderer already has full access to everything. This protects secrets *at
 * rest* only -- a copied or synced `setting.json`, a backup, a support log, a
 * different OS account on the same machine. It does not protect against code
 * running as the same OS user.
 */

/**
 * `basic_text` is Electron's last-resort Linux backend: it "encrypts" with a
 * hardcoded key, which is obfuscation, not protection. Storing a credential
 * under it while telling the user it is protected would be a lie, so it is
 * refused the same as no encryption at all.
 */
const REFUSED_LINUX_BACKENDS = ['basic_text', 'unknown'];

export function checkIsSafeStorageAvailable(): boolean {
    try {
        // `isEncryptionAvailable`/`getSelectedStorageBackend` can throw or block
        // on D-Bus before the app is ready.
        if (!app.isReady()) {
            return false;
        }
        if (!safeStorage.isEncryptionAvailable()) {
            return false;
        }
        if (
            process.platform === 'linux' &&
            REFUSED_LINUX_BACKENDS.includes(
                safeStorage.getSelectedStorageBackend(),
            )
        ) {
            return false;
        }
        return true;
    } catch (error) {
        console.log('Error checking safe storage availability', error);
        return false;
    }
}

/**
 * Base64, not `JSON.stringify(buffer)`: the latter yields
 * `{"type":"Buffer","data":[...]}`, roughly four times the size and dependent on
 * Node's Buffer serialization shape.
 */
export function encryptToBase64(plainText: string): string | null {
    try {
        return safeStorage.encryptString(plainText).toString('base64');
    } catch (error) {
        console.log('Error encrypting a secure setting', error);
        return null;
    }
}

/**
 * Returns null for anything unreadable. That is expected, not exceptional: the
 * blob is bound to the OS user (and on macOS to the app's code signature), so
 * copying a profile to another account or machine makes every blob undecryptable.
 */
export function decryptFromBase64(base64Text: string): string | null {
    try {
        return safeStorage.decryptString(Buffer.from(base64Text, 'base64'));
    } catch (error) {
        console.log('Error decrypting a secure setting', error);
        return null;
    }
}

/**
 * Mirrors the secret field lists in `src/helper/ai/aiHelpers.ts` and
 * `src/plugins/song-select/songSelectSettingHelpers.ts`. `electron/` and `src/`
 * are separate tsconfig projects that share no modules, so this duplication is
 * deliberate -- change both together.
 */
const LEGACY_PLAINTEXT_SECRET_FIELDS: Record<string, string[]> = {
    'ai-setting': ['openAIAPIKey', 'anthropicAPIKey'],
    'song-select-setting': [
        'clientSecret',
        'subscriptionKey',
        'accessToken',
        'refreshToken',
    ],
};

/**
 * Non-secret fields that only make sense while their secret is present. Left
 * alone they become lies the app reads back: a token expiry with no token, an
 * auto play flag with no API key.
 */
const LEGACY_DEPENDENT_FIELD_RESETS: Record<string, Record<string, any>> = {
    'ai-setting': { isAutoPlay: false },
    'song-select-setting': { accessTokenExpiresAt: 0 },
};

/**
 * Every build before this one wrote those fields in cleartext. They are
 * deliberately NOT migrated into the secure store (the user re-enters them), but
 * they must not survive on disk, so every launch strips them.
 *
 * No "already migrated" marker is kept: deleting is idempotent, so a second
 * launch changes nothing and writes nothing, and a restored profile backup gets
 * scrubbed again rather than being wrongly skipped.
 *
 * Note this removes the value from the *logical* file only. `save()` truncates
 * and rewrites in place, so old bytes can linger in free blocks, and any backup
 * or synced copy of the settings file still holds the cleartext. Users must
 * ROTATE the keys, not merely re-enter them.
 *
 * @returns true when something was removed and the caller must persist.
 */
export function scrubLegacyPlaintextSecrets(
    clientSetting: Record<string, any>,
): boolean {
    let isChanged = false;
    for (const [key, fieldNames] of Object.entries(
        LEGACY_PLAINTEXT_SECRET_FIELDS,
    )) {
        const rawValue = clientSetting[key];
        if (typeof rawValue !== 'string') {
            continue;
        }
        let data: any;
        try {
            data = JSON.parse(rawValue);
        } catch (_error) {
            // Unparsable, so nothing can read it back either, but it may still
            // hold a key. Drop the whole entry.
            delete clientSetting[key];
            isChanged = true;
            continue;
        }
        if (data === null || typeof data !== 'object') {
            continue;
        }
        let isEntryChanged = false;
        for (const fieldName of fieldNames) {
            if (fieldName in data) {
                delete data[fieldName];
                isEntryChanged = true;
            }
        }
        if (isEntryChanged) {
            Object.assign(data, LEGACY_DEPENDENT_FIELD_RESETS[key] ?? {});
            clientSetting[key] = JSON.stringify(data);
            isChanged = true;
        }
    }
    return isChanged;
}
