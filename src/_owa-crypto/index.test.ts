import { describe, expect, test } from 'vitest';

import init, {
    bible_ref,
    decrypt,
    encrypt,
    get_api_key,
    get_api_url,
    is_dev,
    version,
} from './index';

describe('_owa-crypto', () => {
    test('initializes successfully', async () => {
        await expect(init()).resolves.toBeUndefined();
    });

    test('returns passthrough encryption helpers', () => {
        expect(encrypt('Hello World')).toBe('Hello World');
        expect(decrypt('Encrypted Value')).toBe('Encrypted Value');
    });

    test('exposes the current api configuration and version flags', () => {
        expect(get_api_url()).toBe(
            'https://bibles-development.openworship.app',
        );
        expect(get_api_key()).toBe('InJesusChrist');
        expect(version()).toBe('0.0.0');
        expect(is_dev()).toBe(true);
    });

    test('serializes bible references with the expected default flags', () => {
        expect(JSON.parse(bible_ref('John 3:16'))).toEqual({
            isFN: false,
            isLXXDSS: false,
            isS: false,
            isStar: false,
            isTitle: false,
            text: 'John 3:16',
        });
    });
});
