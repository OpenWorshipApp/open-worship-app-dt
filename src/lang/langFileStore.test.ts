import { beforeEach, describe, expect, test, vi } from 'vitest';

// The small per-language files, as the plugin registry hands them over. Under
// vitest the store starts from the checkout's packages (`langSourceFiles`);
// each case replaces them with made-up languages ('xx', 'yy') so it holds
// whatever packages the tree has -- or none.

async function importStore() {
    vi.resetModules();
    return await import('./langFileStore');
}

describe('langFileStore', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test('English is always there, first; the rest by code', async () => {
        const store = await importStore();
        store.setLangFiles(
            [
                ['yy', { 'script.json': { scriptPattern: 'y' } }],
                ['en', { 'script.json': { scriptPattern: 'NOT ENGLISH' } }],
                ['xx', { 'script.json': { scriptPattern: 'x' } }],
            ],
            async () => null,
        );
        expect(store.listLangFileCodes()).toEqual(['en', 'xx', 'yy']);
        expect(store.getLangFile('en', 'assistant.json')).not.toBeNull();
        expect(store.getLangFile('en', 'script.json')).toBeNull();
        expect(
            store.listLangFiles<{ scriptPattern: string }>('script.json'),
        ).toEqual([
            { langCode: 'xx', file: { scriptPattern: 'x' } },
            { langCode: 'yy', file: { scriptPattern: 'y' } },
        ]);
        expect(store.getLangFile('zz', 'script.json')).toBeNull();
    });

    test('a change is counted and told', async () => {
        const store = await importStore();
        const listener = vi.fn();
        const unregister = store.onLangFilesChanged(listener);
        const version = store.getLangFilesVersion();
        store.setLangFiles([['xx', {}]], async () => null);
        expect(store.getLangFilesVersion()).toBe(version + 1);
        expect(listener).toHaveBeenCalledOnce();
        unregister();
        store.setLangFiles([], async () => null);
        expect(listener).toHaveBeenCalledOnce();
    });

    test('a bigger file is read when asked, only for a language here', async () => {
        const store = await importStore();
        const loader = vi.fn(async (langCode: string, fileName: string) => {
            return fileName === 'questions.json' ? { langCode } : null;
        });
        store.setLangFiles([['xx', {}]], loader);
        await expect(
            store.loadLangFile('xx', 'questions.json'),
        ).resolves.toEqual({ langCode: 'xx' });
        await expect(store.loadLangFile('yy', 'questions.json')).resolves.toBe(
            null,
        );
        await expect(store.loadLangFile('en', 'questions.json')).resolves.toBe(
            null,
        );
        expect(loader).toHaveBeenCalledOnce();
        loader.mockRejectedValueOnce(new Error('gone'));
        await expect(store.loadLangFile('xx', 'questions.json')).resolves.toBe(
            null,
        );
    });

    test('ensureLangFiles makes a file synchronous for every language', async () => {
        const store = await importStore();
        const listener = vi.fn();
        store.onLangFilesChanged(listener);
        store.setLangFiles(
            [
                ['xx', {}],
                ['yy', {}],
            ],
            async (langCode) => {
                return langCode === 'xx' ? { name: 'X' } : null;
            },
        );
        listener.mockClear();
        await store.ensureLangFiles('assistant.json');
        expect(store.getLangFile('xx', 'assistant.json')).toEqual({
            name: 'X',
        });
        expect(store.getLangFile('yy', 'assistant.json')).toBeNull();
        expect(listener).toHaveBeenCalledOnce();
        // Nothing new: nothing told.
        await store.ensureLangFiles('assistant.json');
        expect(listener).toHaveBeenCalledOnce();
    });
});
