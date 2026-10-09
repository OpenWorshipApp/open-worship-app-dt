// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

const bases = new Map<number, any>();

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isWindows: false } },
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        listKeys: vi.fn(async () => ['screen-bg-manager', 'api-key']),
        getItem: vi.fn((key: string) => `value:${key}`),
    },
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getScreenManagerBase: (screenId: number) => bases.get(screenId) ?? null,
}));

import { getMirrorBootstrap } from './screenBootstrapHelpers';

describe('getMirrorBootstrap', () => {
    test("carries the screen's state and that of every screen it shows", async () => {
        const ownMessages = [
            { screenId: 0, type: 'background', data: { src: 'red' } },
        ];
        const payload = {
            sourceScreenId: 2,
            width: 1600,
            height: 1000,
            stage: 1,
            isSnapshot: true,
            messages: [],
        };
        bases.set(2, { genScreenShowPayload: () => payload });
        const manager = {
            screenId: 0,
            stage: 3,
            genSyncSnapshotMessages: () => ownMessages,
            screenForegroundManager: {
                // Itself (a colour-note group's copy), a source, and a screen
                // that no longer exists.
                foregroundData: {
                    screenDataList: [{ id: 0 }, { id: 2 }, { id: 9 }],
                },
            },
        };

        const context = await getMirrorBootstrap(manager as any);

        expect(context.screenId).toBe(0);
        expect(context.stage).toBe(3);
        // Only what a screen draws with, never anything else.
        expect(context.settings).toEqual({
            'screen-bg-manager': 'value:screen-bg-manager',
        });
        expect(context.messages).toEqual([
            { screenId: 0, type: 'screen-show', data: payload },
            ...ownMessages,
        ]);
    });
});
