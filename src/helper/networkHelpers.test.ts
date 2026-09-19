import { beforeEach, describe, expect, test, vi } from 'vitest';

const { fetchMock, getApiKeyMock, getApiUrlMock } = vi.hoisted(() => ({
    fetchMock: vi.fn(),
    getApiKeyMock: vi.fn(),
    getApiUrlMock: vi.fn(),
}));

vi.mock('../_owa-crypto', () => ({
    get_api_key: getApiKeyMock,
    get_api_url: getApiUrlMock,
}));

import { appApiFetch } from './networkHelpers';

describe('networkHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();

        getApiUrlMock.mockReturnValue('https://api.example.com');
        getApiKeyMock.mockReturnValue('secret-key');
        fetchMock.mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
    });

    test('adds the API key header when no options are provided', async () => {
        const response = await appApiFetch('status');

        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.example.com/status',
            {
                headers: {
                    'x-api-key': 'secret-key',
                },
            },
        );
        expect(response).toEqual({ ok: true });
    });

    test('preserves existing options and merges the API key into headers', async () => {
        const options = {
            method: 'POST',
            body: JSON.stringify({ ok: true }),
            headers: {
                'content-type': 'application/json',
            },
        };

        await appApiFetch('submit', options);

        expect(options).toEqual({
            method: 'POST',
            body: JSON.stringify({ ok: true }),
            headers: {
                'content-type': 'application/json',
                'x-api-key': 'secret-key',
            },
        });
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.example.com/submit',
            options,
        );
    });
});
