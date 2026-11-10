import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        appProvider: {
            isPageScreen: false,
            screenUtils: undefined as
                | { getContext: () => { settings: Record<string, string> } }
                | undefined,
        },
        listeners: [] as ((key: string, value: string | null) => void)[],
    };
});

vi.mock('../../server/appProvider', () => ({
    default: h.appProvider,
}));

vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    addSettingWriteListener: (
        listener: (key: string, value: string | null) => void,
    ) => {
        h.listeners.push(listener);
        return () => {};
    },
}));

async function loadHelpers() {
    vi.resetModules();
    return await import('./screenSettingPushHelpers');
}

beforeEach(() => {
    h.appProvider.isPageScreen = false;
    h.appProvider.screenUtils = undefined;
    h.listeners = [];
});

describe('which writes go to the screens', () => {
    test('a setting the screens draw with goes, as it is', async () => {
        const { genScreenSettingPatch } = await loadHelpers();
        expect(
            genScreenSettingPatch('screen-bible--line-sync-0', 'true'),
        ).toEqual({ settings: { 'screen-bible--line-sync-0': 'true' } });
        expect(genScreenSettingPatch('pdf-full-width', 'false')).toEqual({
            settings: { 'pdf-full-width': 'false' },
        });
        // Removed: the screen drops it too.
        expect(genScreenSettingPatch('pt-effect-background', null)).toEqual({
            settings: { 'pt-effect-background': null },
        });
    });

    test('anything else stays on this computer', async () => {
        const { genScreenSettingPatch } = await loadHelpers();
        expect(genScreenSettingPatch('ai-enabled', 'true')).toBeNull();
        expect(genScreenSettingPatch('language-locale', 'xx-XX')).toBeNull();
    });

    test("a layer's own state does not: it travels as that layer's message", async () => {
        const { genScreenSettingPatch } = await loadHelpers();
        for (const key of [
            'screen-vary-app-document-manager',
            'screen-foreground-manager',
            'screen-bg-manager',
            'screen-ft-manager',
            'screen-draw-data-0',
        ]) {
            expect(genScreenSettingPatch(key, '{}')).toBeNull();
        }
    });

    test('a value too long for the copy a screen opens with is dropped there', async () => {
        const { genScreenSettingPatch } = await loadHelpers();
        expect(
            genScreenSettingPatch(
                'foreground-message-text',
                'x'.repeat(256000),
            ),
        ).toEqual({ settings: { 'foreground-message-text': null } });
    });
});

describe('the presenter sends what it writes', () => {
    test('each presentation setting it writes, and nothing else', async () => {
        const { initScreenSettingPush } = await loadHelpers();
        const sent: unknown[] = [];
        initScreenSettingPush((patch) => {
            sent.push(patch);
        });
        // Once per window, however often it is asked.
        initScreenSettingPush(() => {
            throw new Error('a second sender must not be registered');
        });
        expect(h.listeners).toHaveLength(1);

        h.listeners[0]('screen-bible--line-sync-1', 'false');
        h.listeners[0]('ai-enabled', 'false');
        h.listeners[0]('screen-bg-manager', '{}');

        expect(sent).toEqual([
            { settings: { 'screen-bible--line-sync-1': 'false' } },
        ]);
    });

    test('a screen page sends nothing', async () => {
        h.appProvider.isPageScreen = true;
        const { initScreenSettingPush } = await loadHelpers();
        initScreenSettingPush(() => {});
        expect(h.listeners).toHaveLength(0);
    });
});

describe('a screen page takes it into its own copy', () => {
    test('sets, drops, and ignores what is not a presentation setting', async () => {
        h.appProvider.isPageScreen = true;
        const settings: Record<string, string> = {
            'screen-bible--line-sync-0': 'false',
            'pt-effect-background': 'fade',
        };
        h.appProvider.screenUtils = { getContext: () => ({ settings }) };
        const { applyScreenSettingPatch } = await loadHelpers();

        applyScreenSettingPatch({
            settings: {
                'screen-bible--line-sync-0': 'true',
                'pt-effect-background': null,
                'ai-enabled': 'true',
            },
        });

        expect(settings).toEqual({ 'screen-bible--line-sync-0': 'true' });
    });

    test('a presenter or a malformed message changes nothing', async () => {
        const settings: Record<string, string> = { 'pdf-full-width': 'true' };
        h.appProvider.screenUtils = { getContext: () => ({ settings }) };
        const { applyScreenSettingPatch } = await loadHelpers();

        applyScreenSettingPatch({ settings: { 'pdf-full-width': 'false' } });
        h.appProvider.isPageScreen = true;
        applyScreenSettingPatch(null);
        applyScreenSettingPatch({ settings: ['pdf-full-width'] });
        applyScreenSettingPatch({ settings: { 'pdf-full-width': 42 } });

        expect(settings).toEqual({ 'pdf-full-width': 'true' });
    });
});
