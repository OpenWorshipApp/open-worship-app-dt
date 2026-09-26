import { describe, expect, it, vi } from 'vitest';

import {
    checkShouldLockdownRenderer,
    lockdownRenderer,
} from './rendererLockdown';

// A stand-in for a renderer that still has node integration. The real one is
// `globalThis`; this exists so a test never has to take `require` away from
// the process running it.
function genNodeScope() {
    const fakeRequire = (name: string) => {
        return { name };
    };
    const scope: any = {
        require: fakeRequire,
        module: { require: fakeRequire, exports: {} },
        exports: {},
        __dirname: 'C:/app',
        __filename: 'C:/app/index.js',
        process: {
            platform: 'win32',
            env: { ANTHROPIC_API_KEY: 'sk-ant-secret', PATH: 'C:/bin' },
            mainModule: { require: fakeRequire },
            binding: () => {},
            dlopen: () => {},
        },
    };
    return scope;
}

describe('checkShouldLockdownRenderer', () => {
    it('names the windows that hold outside content, nothing else', () => {
        expect(checkShouldLockdownRenderer('/chatbot.html')).toBe(true);
        expect(checkShouldLockdownRenderer('/chatbot.html?uuid=chatbot')).toBe(
            true,
        );
        expect(checkShouldLockdownRenderer('/aichat.html?uuid=aichat')).toBe(
            true,
        );
        expect(
            checkShouldLockdownRenderer(
                '/markdownPreview.html?preview-file=%2Fa.md&uuid=preview',
            ),
        ).toBe(true);
        for (const pathName of [
            '/presenter.html',
            '/reader.html',
            '/setting.html',
            '/screen.html',
            '/bibleNote.html',
            '',
        ]) {
            expect(checkShouldLockdownRenderer(pathName)).toBe(false);
        }
    });
});

describe('lockdownRenderer', () => {
    it('takes require away, and the ways back to it', () => {
        const scope = genNodeScope();
        const revoked = lockdownRenderer(scope);
        expect(revoked).toContain('require');
        expect(scope.require).toBeUndefined();
        // `module.require` and `process.mainModule.require` are live handles
        // to the same loader; deleting `require` alone would be theatre.
        expect(scope.module).toBeUndefined();
        expect(scope.__dirname).toBeUndefined();
        expect(scope.__filename).toBeUndefined();
        expect(scope.process.mainModule).toBeUndefined();
    });

    it('leaves a process-shaped object behind, with nothing in it', () => {
        const scope = genNodeScope();
        lockdownRenderer(scope);
        // The SDKs in this window probe `process.env` for a key on start-up;
        // removing the object outright makes them throw instead of shrugging.
        expect(scope.process).toBeDefined();
        expect(scope.process.env).toEqual({});
        expect(scope.process.env.ANTHROPIC_API_KEY).toBeUndefined();
        expect(scope.process.platform).toBe('win32');
        expect(typeof scope.process.nextTick).toBe('function');
        expect(scope.process.binding).toBeUndefined();
        expect(scope.process.dlopen).toBeUndefined();
        expect(Object.isFrozen(scope.process)).toBe(true);
    });

    it('keeps nextTick asynchronous in the decoy process', async () => {
        const scope = genNodeScope();
        lockdownRenderer(scope);
        const callback = vi.fn();

        scope.process.nextTick(callback);
        expect(callback).not.toHaveBeenCalled();
        await Promise.resolve();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('redefines process when an assignment is silently ignored', () => {
        const realProcess = { platform: 'linux', env: { SECRET: 'value' } };
        const scope: any = {};
        Object.defineProperty(scope, 'process', {
            configurable: true,
            get: () => realProcess,
            set: () => {},
        });

        expect(lockdownRenderer(scope)).toContain('process');
        expect(scope.process).not.toBe(realProcess);
        expect(scope.process).toMatchObject({ platform: 'linux', env: {} });
        expect(Object.getOwnPropertyDescriptor(scope, 'process')).toMatchObject(
            {
                configurable: false,
                enumerable: false,
                writable: false,
            },
        );
    });

    // A lockdown that quietly did nothing would be worse than none: everything
    // downstream gets written believing it held.
    it('reports a global it could not revoke, rather than claiming it did', () => {
        const scope: any = {};
        Object.defineProperty(scope, 'require', {
            configurable: false,
            writable: false,
            value: () => {},
        });
        expect(lockdownRenderer(scope)).not.toContain('require');
        // Nothing was reported as revoked, which is the honest answer -- the
        // property is non-configurable and non-writable, so it stands.
        expect(typeof scope.require).toBe('function');
    });

    it('empties a global that will not delete but will still be written', () => {
        const scope: any = {};
        Object.defineProperty(scope, 'require', {
            configurable: false,
            writable: true,
            value: () => {},
        });
        expect(lockdownRenderer(scope)).toContain('require');
        expect(scope.require).toBeUndefined();
    });

    // A configurable accessor deletes like anything else -- which is why there
    // is no throwing-getter fallback: it could only ever be installed over a
    // property that had already gone.
    it('deletes a global defined as a getter', () => {
        const scope: any = {};
        Object.defineProperty(scope, 'require', {
            configurable: true,
            get() {
                return () => {};
            },
        });
        expect(lockdownRenderer(scope)).toContain('require');
        expect(scope.require).toBeUndefined();
    });

    it('does nothing at all in a window that never had Node', () => {
        const scope: any = {};
        expect(lockdownRenderer(scope)).toEqual([]);
    });
});
