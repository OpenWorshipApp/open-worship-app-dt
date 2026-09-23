import { afterEach, describe, expect, test } from 'vitest';

import { startOwaMcpHost } from './host.mjs';

const hosts = [];

afterEach(async () => {
    await Promise.all(hosts.splice(0).map((host) => host.close()));
});

describe('the HTTP MCP credential', () => {
    test('refuses missing and wrong bearer tokens before opening a session', async () => {
        const host = await startOwaMcpHost({ port: 0 });
        hosts.push(host);
        const body = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
        });

        const missing = await fetch(host.url, { method: 'POST', body });
        const wrong = await fetch(host.url, {
            method: 'POST',
            headers: { authorization: 'Bearer not-the-token' },
            body,
        });

        expect(missing.status).toBe(401);
        expect(missing.headers.get('www-authenticate')).toBe('Bearer');
        expect(wrong.status).toBe(401);
        expect(await missing.json()).toEqual({ error: 'Unauthorized' });
        expect(await wrong.json()).toEqual({ error: 'Unauthorized' });
    });

    test('accepts the published token without putting it in the URL', async () => {
        const host = await startOwaMcpHost({ port: 0 });
        hosts.push(host);

        const response = await fetch(host.url, {
            method: 'POST',
            headers: { authorization: `Bearer ${host.token}` },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list',
            }),
        });

        // The request reached normal MCP routing. No initialize means no
        // session, so the expected answer is 404 rather than the auth 401.
        expect(response.status).toBe(404);
        expect(host.token).toHaveLength(43);
        expect(host.url).not.toContain(host.token);
    });
});
