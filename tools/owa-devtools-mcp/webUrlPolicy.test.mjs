import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    WEB_URL_MAX_LENGTH,
    checkIsPrivateAddress,
    checkIsPublicHost,
    checkWebUrl,
} from './webUrlPolicy.mjs';

describe('checkWebUrl', () => {
    it('allows an ordinary public https page', () => {
        const verdict = checkWebUrl(
            'https://en.wikipedia.org/wiki/King_James_Version',
        );
        expect(verdict.isAllowed).toBe(true);
        expect(verdict.hostname).toBe('en.wikipedia.org');
        // The caller must fetch the NORMALISED address, so it is handed back.
        expect(verdict.href).toBe(
            'https://en.wikipedia.org/wiki/King_James_Version',
        );
    });

    // The whole reason this file exists. Both of the app's own doors are on
    // loopback and neither has a credential, so a fetch tool that could say
    // 127.0.0.1 would be a way to drive the app from inside an answer.
    it('refuses the loopback address the app serves its own doors on', () => {
        const verdict = checkWebUrl('https://127.0.0.1:39223/mcp');
        expect(verdict.isAllowed).toBe(false);
        expect(verdict.reason).toContain('local network');
    });

    // Node's URL parser canonicalises all of these to 127.0.0.1 before the
    // policy sees them. The test is here because that is a property of the
    // parser rather than of this file, and it must not be quietly lost.
    it.each([
        ['octal', 'https://0177.0.0.1/'],
        ['a bare integer', 'https://2130706433/'],
        ['hex', 'https://0x7f.1/'],
        ['a short form', 'https://127.1/'],
    ])('refuses loopback written as %s', (_name, url) => {
        expect(checkWebUrl(url).isAllowed).toBe(false);
    });

    it.each([
        ['IPv6 loopback', 'https://[::1]/'],
        ['IPv4 mapped into IPv6', 'https://[::ffff:127.0.0.1]/'],
        ['a link-local address', 'https://[fe80::1]/'],
        ['a unique-local address', 'https://[fd00::1]/'],
    ])('refuses %s', (_name, url) => {
        expect(checkWebUrl(url).isAllowed).toBe(false);
    });

    it.each([
        ["the church's own router", 'https://192.168.1.1/'],
        ['a private range', 'https://10.0.0.5/'],
        ['another private range', 'https://172.16.4.4/'],
        ['cloud metadata', 'https://169.254.169.254/latest/meta-data/'],
        ['carrier-grade NAT', 'https://100.64.0.1/'],
        ['this network', 'https://0.0.0.0/'],
    ])('refuses %s', (_name, url) => {
        expect(checkWebUrl(url).isAllowed).toBe(false);
    });

    it.each([
        ['localhost', 'https://localhost/'],
        ['localhost with a root dot', 'https://LOCALHOST./'],
        ['a single-label intranet name', 'https://intranet/'],
        ['an mDNS name', 'https://printer.local/'],
        ['an internal suffix', 'https://wiki.internal/'],
    ])('refuses %s', (_name, url) => {
        expect(checkWebUrl(url).isAllowed).toBe(false);
    });

    it('refuses every scheme but https', () => {
        for (const url of [
            'file:///etc/passwd',
            'javascript:alert(1)',
            'data:text/html,<b>x</b>',
            'ftp://example.com/x',
        ]) {
            expect(checkWebUrl(url).isAllowed).toBe(false);
        }
    });

    // Plain http gets its own sentence: it is a real address the user may
    // genuinely have, and "not encrypted, ask for the https one" is an
    // instruction the model can act on where a bare refusal is a dead end.
    it('says something useful about plain http', () => {
        const verdict = checkWebUrl('http://example.com/');
        expect(verdict.isAllowed).toBe(false);
        expect(verdict.reason).toContain('not encrypted');
    });

    it('refuses an address long enough to carry a payload out', () => {
        const url = `https://example.com/?q=${'x'.repeat(WEB_URL_MAX_LENGTH)}`;
        const verdict = checkWebUrl(url);
        expect(verdict.isAllowed).toBe(false);
        expect(verdict.reason).toContain('plain address');
    });

    it('refuses nothing at all rather than throwing', () => {
        for (const value of [undefined, null, '', '   ', 42, {}]) {
            expect(checkWebUrl(value).isAllowed).toBe(false);
        }
    });

    // Every refusal is written for the model to act on, which is what makes a
    // block correct behaviour rather than a dead end it apologises for.
    it('always says what to do instead', () => {
        for (const url of ['https://127.0.0.1/', 'http://example.com/']) {
            expect(checkWebUrl(url).reason.length).toBeGreaterThan(40);
        }
    });
});

describe('checkIsPrivateAddress', () => {
    it('reads a v4 address out of an IPv4-mapped v6 one', () => {
        // ::ffff:7f00:1 IS 127.0.0.1, which is the whole point.
        expect(checkIsPrivateAddress('::ffff:7f00:1')).toBe(true);
        expect(checkIsPrivateAddress('::ffff:0808:0808')).toBe(false);
    });

    it('treats anything that is not an address as private', () => {
        // Callers pass RESOLVED addresses, so a hostname here is a bug, and a
        // bug in this direction must fail closed.
        expect(checkIsPrivateAddress('example.com')).toBe(true);
        expect(checkIsPrivateAddress('')).toBe(true);
        expect(checkIsPrivateAddress(null)).toBe(true);
    });

    it('allows ordinary public addresses', () => {
        expect(checkIsPrivateAddress('8.8.8.8')).toBe(false);
        expect(checkIsPrivateAddress('2606:4700::1111')).toBe(false);
    });
});

describe('checkIsPublicHost', () => {
    // DNS is mocked rather than dialled. The rule being tested is "every
    // address this name answers with has to be public", and a test that
    // needed the internet to prove it would fail on the aeroplane and pass
    // for the wrong reason behind a captive portal. The REAL proof -- a
    // public name that genuinely resolves to loopback -- is in
    // `probe-mcp.mjs`, against the live app, where a network is available by
    // definition.
    async function askWith(addressList) {
        vi.doMock('node:dns/promises', () => {
            return {
                lookup: async () => {
                    if (addressList === null) {
                        throw new Error('ENOTFOUND');
                    }
                    return addressList;
                },
            };
        });
        vi.resetModules();
        const { checkIsPublicHost: ask } = await import('./webUrlPolicy.mjs');
        return await ask('somewhere.example');
    }

    afterEach(() => {
        vi.doUnmock('node:dns/promises');
        vi.resetModules();
    });

    it('allows a name that resolves to the public internet', async () => {
        const verdict = await askWith([{ address: '8.8.8.8', family: 4 }]);
        expect(verdict.isAllowed).toBe(true);
    });

    // A public name is free to point at 127.0.0.1, and several domains exist
    // for exactly that. The synchronous check proves nothing about a NAME.
    it('refuses a public name that resolves to loopback', async () => {
        const verdict = await askWith([{ address: '127.0.0.1', family: 4 }]);
        expect(verdict.isAllowed).toBe(false);
        expect(verdict.reason).toContain('local network');
    });

    // EVERY address, not merely the first: a name answering with one public
    // and one private address would otherwise be a coin toss decided by
    // whichever the resolver happened to put first.
    it('refuses a name with one public and one private address', async () => {
        const verdict = await askWith([
            { address: '8.8.8.8', family: 4 },
            { address: '192.168.1.7', family: 4 },
        ]);
        expect(verdict.isAllowed).toBe(false);
    });

    it('refuses a name that resolves to nothing at all', async () => {
        expect((await askWith([])).isAllowed).toBe(false);
    });

    it('says the name could not be found rather than throwing', async () => {
        const verdict = await askWith(null);
        expect(verdict.isAllowed).toBe(false);
        expect(verdict.reason).toContain('could not be found');
    });

    // An address literal has already been judged by `checkWebUrl`; there is
    // nothing to look up, and it must not fall through to DNS.
    it('answers about an address literal without asking DNS', async () => {
        const { checkIsPublicHost: ask } = await import('./webUrlPolicy.mjs');
        expect((await ask('127.0.0.1')).isAllowed).toBe(false);
        expect((await ask('8.8.8.8')).isAllowed).toBe(true);
    });
});
