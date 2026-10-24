import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        sessions: [] as { id: string; name: string }[],
    },
    mocks: {
        addMediaSession: vi.fn(),
        requestForegroundPanelOpening: vi.fn(),
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => state.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        state.settings.set(name, value);
    },
}));
vi.mock('../media-sessions/MediaSessionsComp', () => ({
    addMediaSession: mocks.addMediaSession,
    readSessions: () => state.sessions,
    genMediaSessionId: () => 's9ix',
    toSessionSuffix: (sessionId: string) => {
        return sessionId === '' ? '' : `-${sessionId}`;
    },
}));
vi.mock('../server/fileHelpers', () => ({
    pathBasename: (filePath: string) => filePath.split('/').at(-1) ?? '',
    getFileName: (name: string) => name.substring(0, name.lastIndexOf('.')),
}));
vi.mock('./foregroundSessionHelpers', () => ({
    toForegroundSessionsTarget: (widgetKey: string) => {
        return `foreground-${widgetKey}`;
    },
}));
vi.mock('./foregroundWidgetHelpers', () => ({
    FOREGROUND_OPEN_PANELS_SETTING_NAME: 'foreground-open-panels',
    requestForegroundPanelOpening: mocks.requestForegroundPanelOpening,
    toOpenedPanelKeys: (raw: string, key: string) => {
        const keys = raw === '' ? [] : raw.split(',');
        return (keys.includes(key) ? keys : [...keys, key]).join(',');
    },
}));

import { parseLongTextSession } from './foregroundLongTextHelpers';
import {
    openLyricInLongTextShow,
    toUniqueSessionName,
} from './foregroundLongTextOpenHelpers';

beforeEach(() => {
    state.settings.clear();
    state.sessions = [{ id: '', name: 'Default' }];
    vi.clearAllMocks();
});

describe("a lyric's Long Text Show", () => {
    test('starts a new session named after the song, its English card already written', () => {
        let sessionAtSwitch: string | undefined;
        mocks.addMediaSession.mockImplementation(() => {
            sessionAtSwitch = state.settings.get('long-text-setting-s9ix');
        });
        mocks.requestForegroundPanelOpening.mockReturnValue(true);
        openLyricInLongTextShow('/docs/Still.owl');

        expect(mocks.addMediaSession).toHaveBeenCalledWith(
            'foreground-long-text',
            { id: 's9ix', name: 'Still' },
        );
        // The panel switching to the session reads it then and there.
        expect(parseLongTextSession(sessionAtSwitch)).toEqual({
            languages: [
                {
                    langCode: 'en',
                    source: 'lyric',
                    title: '',
                    sections: [''],
                    lyricFilePath: '/docs/Still.owl',
                    sectionView: 'cards',
                },
            ],
        });
        expect(mocks.requestForegroundPanelOpening).toHaveBeenCalledWith(
            'long-text',
        );
        // A mounted launcher opened it; the setting is the launcher's to write.
        expect(state.settings.has('foreground-open-panels')).toBe(false);
    });

    test('leaves the panel open for the launcher that mounts next when none is up', () => {
        mocks.requestForegroundPanelOpening.mockReturnValue(false);
        state.settings.set('foreground-open-panels', 'message');
        openLyricInLongTextShow('/docs/Still.owl');
        expect(state.settings.get('foreground-open-panels')).toBe(
            'message,long-text',
        );
        openLyricInLongTextShow('/docs/Still.owl');
        expect(state.settings.get('foreground-open-panels')).toBe(
            'message,long-text',
        );
    });

    test('the same song opened again gets a name of its own, not a third "Still"', () => {
        mocks.requestForegroundPanelOpening.mockReturnValue(true);
        state.sessions = [
            { id: '', name: 'Default' },
            { id: 'a', name: 'Still' },
            { id: 'b', name: 'Still (2)' },
        ];
        openLyricInLongTextShow('/docs/Still.owl');
        expect(mocks.addMediaSession.mock.calls[0][1].name).toBe('Still (3)');
        expect(toUniqueSessionName('Still', ['Default'])).toBe('Still');
        expect(toUniqueSessionName('Still', ['Still', 'Still (3)'])).toBe(
            'Still (2)',
        );
    });

    test('a file with no extension is named whole', () => {
        mocks.requestForegroundPanelOpening.mockReturnValue(true);
        openLyricInLongTextShow('/docs/Still');
        expect(mocks.addMediaSession.mock.calls[0][1].name).toBe('Still');
    });
});
