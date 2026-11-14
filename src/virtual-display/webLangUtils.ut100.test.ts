// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { genWebLangUtils as GenWebLangUtilsType } from './webLangUtils';

// `appProvider.langUtils` for a browser watching a virtual display: the
// plugin list and files come from the Screen Mirror server, a plugin's
// factory from a same-origin script. Each test loads a FRESH module: the
// list and the loaded data are module-level promises.
type WebLangUtilsType = ReturnType<typeof GenWebLangUtilsType>;

const FACTORIES_NAME = '__owaLangPluginFactories';

let fetchMock: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
// What a script appended to <head> does once "loaded": run its factory
// registration, then fire `load` -- or fire `error`.
let scriptOutcome: (src: string) => 'load' | 'error';
let appendedSrcList: string[];

function jsonResponse(value: unknown, ok = true) {
    return { ok, json: async () => value };
}

async function loadUtils(): Promise<WebLangUtilsType> {
    vi.resetModules();
    const { genWebLangUtils } = await import('./webLangUtils');
    return genWebLangUtils();
}

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    appendedSrcList = [];
    scriptOutcome = () => 'load';
    const originalAppend = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
        const appended = originalAppend(node);
        if (node instanceof HTMLScriptElement) {
            appendedSrcList.push(node.src);
            const outcome = scriptOutcome(node.src);
            queueMicrotask(() => {
                if (outcome === 'load') {
                    node.onload?.(new Event('load'));
                } else {
                    node.onerror?.(new Event('error'));
                }
            });
        }
        return appended;
    });
    delete (globalThis as any)[FACTORIES_NAME];
});
afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as any)[FACTORIES_NAME];
    document.head.innerHTML = '';
});

const origin = () => {
    return globalThis.location.origin;
};

describe('the plugin list', () => {
    test('is read once from the server, never from a cache, and kept', async () => {
        const list = [{ langCode: 'xx' }, { langCode: 'yy' }];
        fetchMock.mockResolvedValue(jsonResponse(list));
        const utils = await loadUtils();

        expect(await utils.getLangPlugins()).toEqual(list);
        expect(await utils.getLangPlugins()).toEqual(list);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            `${origin()}/@lang/plugins.json`,
            { cache: 'no-store' },
        );
        expect(await utils.getLangPlugin('yy')).toEqual({ langCode: 'yy' });
        expect(await utils.getLangPlugin('zz')).toBeNull();
    });

    test('a refused answer, an answer that is no list and a failed fetch are all empty', async () => {
        fetchMock.mockResolvedValue(jsonResponse(null, false));
        expect(await (await loadUtils()).getLangPlugins()).toEqual([]);

        fetchMock.mockResolvedValue(jsonResponse({ langCode: 'xx' }));
        expect(await (await loadUtils()).getLangPlugins()).toEqual([]);

        fetchMock.mockRejectedValue(new Error('offline'));
        expect(await (await loadUtils()).getLangPlugins()).toEqual([]);
    });

    test('the viewer has no plugin folder on disk', async () => {
        expect((await loadUtils()).getLangPluginsDirPath()).toBeNull();
    });
});

describe('a language’s data', () => {
    test('a language the server does not list loads no script', async () => {
        fetchMock.mockResolvedValue(jsonResponse([{ langCode: 'xx' }]));
        const utils = await loadUtils();

        expect(await utils.getLangData('zz')).toBeNull();
        expect(appendedSrcList).toEqual([]);
    });

    test('its factory is loaded from the page’s own server and handed a host', async () => {
        fetchMock.mockResolvedValue(jsonResponse([{ langCode: 'xx' }]));
        const workerList: any[] = [];
        vi.stubGlobal(
            'Worker',
            class {
                constructor(url: string, options?: WorkerOptions) {
                    workerList.push({ url, options });
                }
            },
        );
        let host: any = null;
        scriptOutcome = () => {
            (globalThis as any)[FACTORIES_NAME] = {
                xx: (given: any) => {
                    host = given;
                    return { langCode: 'xx', name: 'Test language' };
                },
            };
            return 'load';
        };
        const utils = await loadUtils();

        const data = await utils.getLangData('xx');

        const baseUrl = `${origin()}/@lang/xx/`;
        expect(data).toEqual({ langCode: 'xx', name: 'Test language' });
        expect(appendedSrcList).toEqual([`${baseUrl}index.js`]);
        const script = document.head.querySelector('script')!;
        expect(script.async).toBe(true);
        expect(host.langCode).toBe('xx');
        expect(host.baseUrl).toBe(baseUrl);
        expect(host.dirPath).toBeNull();
        expect(host.assetUrl('fonts/face.woff2')).toBe(
            `${baseUrl}fonts/face.woff2`,
        );
        expect(host.toFilePath()).toBe('');
        expect(host.onOpenLyricInternal()).toBeUndefined();
        host.createWorker('worker.js', { type: 'module' });
        expect(workerList).toEqual([
            { url: 'worker.js', options: { type: 'module' } },
        ]);

        // Asked again: the same data, no second script.
        expect(await utils.getLangData('xx')).toBe(data);
        expect(appendedSrcList).toHaveLength(1);
    });

    test('a script that registers no factory, or a factory that gives nothing, is no data', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse([{ langCode: 'xx' }, { langCode: 'yy' }]),
        );
        scriptOutcome = (src) => {
            if (src.includes('/yy/')) {
                (globalThis as any)[FACTORIES_NAME] = {
                    yy: () => undefined,
                };
            }
            return 'load';
        };
        const utils = await loadUtils();

        expect(await utils.getLangData('xx')).toBeNull();
        expect(await utils.getLangData('yy')).toBeNull();
    });

    test('a script that fails to load is logged, answers null, and is tried again next time', async () => {
        fetchMock.mockResolvedValue(jsonResponse([{ langCode: 'xx' }]));
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        scriptOutcome = () => 'error';
        const utils = await loadUtils();

        expect(await utils.getLangData('xx')).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(String(consoleErrorSpy.mock.calls[0][0])).toContain(
            `Failed to load ${origin()}/@lang/xx/index.js`,
        );

        scriptOutcome = () => {
            (globalThis as any)[FACTORIES_NAME] = {
                xx: () => ({ langCode: 'xx' }),
            };
            return 'load';
        };
        expect(await utils.getLangData('xx')).toEqual({ langCode: 'xx' });
        expect(appendedSrcList).toHaveLength(2);
    });
});

describe('a plugin’s JSON file', () => {
    test('only a plain JSON file name is fetched', async () => {
        const utils = await loadUtils();

        expect(await utils.readLangPluginJson('xx', '../secret.json')).toBe(
            null,
        );
        expect(await utils.readLangPluginJson('xx', 'typed.txt')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('is read from the plugin’s folder on the server', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ name: 'Test' }));
        const utils = await loadUtils();

        expect(await utils.readLangPluginJson('xx', 'typed.json')).toEqual({
            name: 'Test',
        });
        expect(fetchMock).toHaveBeenCalledWith(
            `${origin()}/@lang/xx/typed.json`,
        );
    });

    test('a refused answer or a failed fetch is null', async () => {
        const utils = await loadUtils();
        fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
        expect(await utils.readLangPluginJson('xx', 'typed.json')).toBeNull();
        fetchMock.mockRejectedValueOnce(new Error('offline'));
        expect(await utils.readLangPluginJson('xx', 'typed.json')).toBeNull();
    });
});
