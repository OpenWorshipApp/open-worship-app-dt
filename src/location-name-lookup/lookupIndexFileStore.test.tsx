// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    langListeners: new Set<() => void>(),
    unsubscribeLang: vi.fn(),
    error: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: { appInfo: { version: '1' } },
}));
vi.mock('../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorageDirPath: '/data' },
}));
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getLangDataByCodeAsync: vi.fn(),
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.error }));
vi.mock('./lookupLangHelpers', () => ({
    getSelectedLookupLangCode: () => 'en',
    subscribeLookupLangCode: (listener: () => void) => {
        h.langListeners.add(listener);
        return () => {
            h.langListeners.delete(listener);
            h.unsubscribeLang();
        };
    },
}));

import {
    genLookupFileStore,
    genLookupLangFileStore,
} from './lookupIndexFileHelpers';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

let roots: Root[];
let containers: HTMLDivElement[];
function mount(ProbeComp: () => ReturnType<typeof createElement>) {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    containers.push(container);
    return { root, container, ProbeComp };
}
async function render(view: ReturnType<typeof mount>) {
    await act(async () => {
        view.root.render(createElement(view.ProbeComp));
    });
}
async function unmount(view: ReturnType<typeof mount>) {
    await act(async () => {
        view.root.unmount();
    });
    roots.splice(roots.indexOf(view.root), 1);
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    roots = [];
    containers = [];
    h.langListeners.clear();
    h.unsubscribeLang.mockClear();
    h.error.mockClear();
});
afterEach(async () => {
    await act(async () => {
        roots.forEach((root) => root.unmount());
    });
    containers.forEach((container) => container.remove());
    vi.unstubAllGlobals();
});

describe('subscriber-counted lookup file stores', () => {
    test('shares one load across readers and drops the value after the last leaves', async () => {
        const firstLoad = deferred<string | null>();
        const secondLoad = deferred<string | null>();
        const load = vi
            .fn()
            .mockReturnValueOnce(firstLoad.promise)
            .mockReturnValueOnce(secondLoad.promise);
        const useValue = genLookupFileStore<string>(load);
        const ProbeComp = () =>
            createElement('span', {}, useValue() ?? 'loading');
        const first = mount(ProbeComp);
        const second = mount(ProbeComp);
        await render(first);
        await render(second);
        expect(load).toHaveBeenCalledTimes(1);
        expect(first.container.textContent).toBe('loading');
        await act(async () => {
            firstLoad.resolve('index-1');
            await firstLoad.promise;
        });
        expect(first.container.textContent).toBe('index-1');
        expect(second.container.textContent).toBe('index-1');
        await unmount(first);
        expect(second.container.textContent).toBe('index-1');
        await unmount(second);
        const third = mount(ProbeComp);
        await render(third);
        expect(load).toHaveBeenCalledTimes(2);
        expect(third.container.textContent).toBe('loading');
        await act(async () => {
            secondLoad.resolve('index-2');
            await secondLoad.promise;
        });
        expect(third.container.textContent).toBe('index-2');
    });

    test('does not keep a resolved file when every reader left during the load', async () => {
        const pending = deferred<string | null>();
        const load = vi
            .fn()
            .mockReturnValueOnce(pending.promise)
            .mockResolvedValueOnce('new value');
        const useValue = genLookupFileStore<string>(load);
        const ProbeComp = () =>
            createElement('span', {}, useValue() ?? 'loading');
        const first = mount(ProbeComp);
        await render(first);
        await unmount(first);
        await act(async () => {
            pending.resolve('abandoned');
            await pending.promise;
        });
        const next = mount(ProbeComp);
        await render(next);
        expect(load).toHaveBeenCalledTimes(2);
        expect(next.container.textContent).toBe('new value');
    });

    test('language change clears old labels and rejects a stale in-flight result', async () => {
        const oldLoad = deferred<string | null>();
        const newLoad = deferred<string | null>();
        const load = vi
            .fn()
            .mockReturnValueOnce(oldLoad.promise)
            .mockReturnValueOnce(newLoad.promise);
        const useValue = genLookupFileStore<string>(load, true);
        const view = mount(() =>
            createElement('span', {}, useValue() ?? 'loading'),
        );
        await render(view);
        expect(h.langListeners.size).toBe(1);
        await act(async () => {
            h.langListeners.forEach((listener) => listener());
        });
        expect(load).toHaveBeenCalledTimes(2);
        await act(async () => {
            oldLoad.resolve('old language');
            await oldLoad.promise;
        });
        expect(view.container.textContent).toBe('loading');
        await act(async () => {
            newLoad.resolve('new language');
            await newLoad.promise;
        });
        expect(view.container.textContent).toBe('new language');
        await unmount(view);
        expect(h.unsubscribeLang).toHaveBeenCalledTimes(1);
    });

    test('different Bible languages load independently and release separately', async () => {
        const xxLoad = deferred<string | null>();
        const yyLoad = deferred<string | null>();
        const load = vi.fn((lang: string) =>
            lang === 'xx' ? xxLoad.promise : yyLoad.promise,
        );
        const useValue = genLookupLangFileStore<string>(load);
        const firstView = mount(() =>
            createElement('span', {}, useValue('xx') ?? 'loading'),
        );
        const secondView = mount(() =>
            createElement('span', {}, useValue('yy') ?? 'loading'),
        );
        await render(firstView);
        await render(secondView);
        expect(load.mock.calls.map(([lang]) => lang)).toEqual(['xx', 'yy']);
        await act(async () => {
            xxLoad.resolve('xx needles');
            await xxLoad.promise;
        });
        expect(firstView.container.textContent).toBe('xx needles');
        expect(secondView.container.textContent).toBe('loading');
        await act(async () => {
            yyLoad.resolve('yy needles');
            await yyLoad.promise;
        });
        expect(secondView.container.textContent).toBe('yy needles');
        await unmount(firstView);
        expect(secondView.container.textContent).toBe('yy needles');
    });

    test('empty Bible language never loads and a departed language cannot revive its slot', async () => {
        const oldLoad = deferred<string | null>();
        const load = vi
            .fn()
            .mockReturnValueOnce(oldLoad.promise)
            .mockResolvedValueOnce('fresh');
        const useValue = genLookupLangFileStore<string>(load);
        const empty = mount(() =>
            createElement('span', {}, useValue('') ?? 'none'),
        );
        await render(empty);
        expect(empty.container.textContent).toBe('none');
        expect(load).not.toHaveBeenCalled();

        const old = mount(() =>
            createElement('span', {}, useValue('xx') ?? 'loading'),
        );
        await render(old);
        await unmount(old);
        await act(async () => {
            oldLoad.resolve('stale');
            await oldLoad.promise;
        });
        const fresh = mount(() =>
            createElement('span', {}, useValue('xx') ?? 'loading'),
        );
        await render(fresh);
        expect(load).toHaveBeenCalledTimes(2);
        expect(fresh.container.textContent).toBe('fresh');
    });

    test('a rejected load reports the error and permits another subscription to retry', async () => {
        const first = deferred<string | null>();
        const load = vi
            .fn()
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce('recovered');
        const useValue = genLookupLangFileStore<string>(load);
        const view = mount(() =>
            createElement('span', {}, useValue('xx') ?? 'loading'),
        );
        await render(view);
        const error = new Error('disk failed');
        await act(async () => {
            first.reject(error);
            await first.promise.catch(() => {});
        });
        expect(h.error).toHaveBeenCalledWith(error);
        await unmount(view);
        const again = mount(() =>
            createElement('span', {}, useValue('xx') ?? 'loading'),
        );
        await render(again);
        expect(again.container.textContent).toBe('recovered');
    });
});

describe('lookup file stores after a failed or stale load', () => {
    test('a rejected load is reported and the next reader tries again', async () => {
        const first = deferred<string | null>();
        const load = vi
            .fn()
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce('recovered');
        const useValue = genLookupFileStore<string>(load);
        const ProbeComp = () =>
            createElement('span', {}, useValue() ?? 'loading');
        const view = mount(ProbeComp);
        await render(view);
        const error = new Error('index unreadable');
        await act(async () => {
            first.reject(error);
            await first.promise.catch(() => {});
        });
        expect(h.error).toHaveBeenCalledWith(error);
        expect(view.container.textContent).toBe('loading');
        const second = mount(ProbeComp);
        await render(second);
        expect(load).toHaveBeenCalledTimes(2);
        expect(second.container.textContent).toBe('recovered');
        expect(view.container.textContent).toBe('recovered');
    });

    test('a stale rejection after a language change leaves the new load alone', async () => {
        const oldLoad = deferred<string | null>();
        const newLoad = deferred<string | null>();
        const load = vi
            .fn()
            .mockReturnValueOnce(oldLoad.promise)
            .mockReturnValueOnce(newLoad.promise);
        const useValue = genLookupFileStore<string>(load, true);
        const ProbeComp = () =>
            createElement('span', {}, useValue() ?? 'loading');
        const view = mount(ProbeComp);
        await render(view);
        await act(async () => {
            h.langListeners.forEach((listener) => listener());
        });
        expect(load).toHaveBeenCalledTimes(2);
        const error = new Error('old language file');
        await act(async () => {
            oldLoad.reject(error);
            await oldLoad.promise.catch(() => {});
        });
        expect(h.error).toHaveBeenCalledWith(error);
        // The new load is still in flight: a second reader joins it.
        const second = mount(ProbeComp);
        await render(second);
        expect(load).toHaveBeenCalledTimes(2);
        await act(async () => {
            newLoad.resolve('new language');
            await newLoad.promise;
        });
        expect(view.container.textContent).toBe('new language');
        expect(second.container.textContent).toBe('new language');
    });

    test('readers of one Bible language share its load and its loaded value', async () => {
        const xxLoad = deferred<string | null>();
        const load = vi.fn(() => xxLoad.promise);
        const useValue = genLookupLangFileStore<string>(load);
        const ProbeComp = () =>
            createElement('span', {}, useValue('xx') ?? 'loading');
        const first = mount(ProbeComp);
        const second = mount(ProbeComp);
        await render(first);
        await render(second);
        expect(load).toHaveBeenCalledTimes(1);
        await act(async () => {
            xxLoad.resolve('xx needles');
            await xxLoad.promise;
        });
        const third = mount(ProbeComp);
        await render(third);
        expect(load).toHaveBeenCalledTimes(1);
        expect(
            [first, second, third].map((view) => {
                return view.container.textContent;
            }),
        ).toEqual(['xx needles', 'xx needles', 'xx needles']);
    });
});
