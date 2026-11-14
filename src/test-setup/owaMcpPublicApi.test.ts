import { describe, expect, expectTypeOf, test } from 'vitest';

import type {
    OwaAppInstance,
    OwaMcpServer,
    OwaMcpTransport,
} from '../../tools/owa-devtools-mcp/index.mjs';
import {
    OWA_CDP_INFO_DIR_PATH,
    createOwaMcpServer,
    findDrivenInstance,
    listOwaAppInstances,
    redactSecrets,
    resolveAppBrowserUrl,
    runOwaMcpBridge,
    runOwaMcpStdioServer,
} from '../../tools/owa-devtools-mcp/index.mjs';

// The npm package `open-worship-app-mcp` exports `index.mjs` typed by
// `index.d.mts`. This file is what `tsc` (`npm run lint`) holds those
// declarations to: written as a TypeScript consumer would write it, so a
// declaration that drifts from the code fails the typecheck, and a declared
// export the code lacks fails here at run time.
describe('the npm package API, as a TypeScript consumer sees it', () => {
    test('finding the app is typed and never carries the door token', () => {
        const instances = listOwaAppInstances();
        expectTypeOf(instances).toEqualTypeOf<OwaAppInstance[]>();
        expect(Array.isArray(instances)).toBe(true);
        for (const instance of instances) {
            expect(instance).not.toHaveProperty('mcpToken');
            expectTypeOf(instance.port).toBeNumber();
        }
        const driven = findDrivenInstance();
        expectTypeOf(driven).toEqualTypeOf<OwaAppInstance | null>();
        if (driven !== null) {
            // @ts-expect-error -- the token is not part of the public shape.
            expect(driven.mcpToken).toBeUndefined();
        }
        expect(resolveAppBrowserUrl()).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
        expect(OWA_CDP_INFO_DIR_PATH).toMatch(/open-worship-app-cdp$/);
    });

    test('the server functions are typed for embedding', () => {
        expectTypeOf(createOwaMcpServer).returns.resolves.toEqualTypeOf<{
            server: OwaMcpServer;
        }>();
        expectTypeOf(runOwaMcpStdioServer).returns.resolves.toHaveProperty(
            'close',
        );
        expectTypeOf(runOwaMcpBridge).returns.resolves.toHaveProperty('port');
        expectTypeOf<OwaMcpServer['connect']>()
            .parameter(0)
            .toEqualTypeOf<OwaMcpTransport>();
        expect(typeof createOwaMcpServer).toBe('function');
        expect(typeof runOwaMcpStdioServer).toBe('function');
        expect(typeof runOwaMcpBridge).toBe('function');
    });

    test('the secret scrubber is the firewall one', () => {
        const key = `sk-${'C'.repeat(26)}`;
        expectTypeOf(redactSecrets).returns.toBeString();
        expect(redactSecrets(`key ${key}`)).not.toContain(key);
    });
});
