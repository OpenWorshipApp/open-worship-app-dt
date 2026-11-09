import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        order: [] as string[],
    },
    mocks: {
        requestForegroundPanelOpening: vi.fn(),
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => state.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        state.order.push(name);
        state.settings.set(name, value);
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
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

import {
    escapeMarkdownText,
    genBibleItemQuickTextMarkdown,
    openBibleItemInQuickText,
} from './foregroundQuickTextOpenHelpers';

function genBibleItem(
    target: Record<string, number | string>,
    text: string,
    title = '(KJV) John 3:16',
) {
    return {
        target: { bookKey: 'JHN', chapter: 3, ...target },
        toTitleWithBibleKey: vi.fn(async () => title),
        toText: vi.fn(async () => text),
    } as any;
}

beforeEach(() => {
    state.settings.clear();
    state.order = [];
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
});

describe('a Bible passage as Quick Text markdown', () => {
    test('escapes only what markdown would act on', () => {
        expect(escapeMarkdownText('a *b* _c_ <i> [d] `e` | ~f~ \\')).toBe(
            String.raw`a \*b\* \_c\_ \<i\> \[d\] \`e\` \| \~f\~ \\`,
        );
        expect(escapeMarkdownText('# not a heading')).toBe(
            String.raw`\# not a heading`,
        );
        expect(escapeMarkdownText('- not a list')).toBe(
            String.raw`\- not a list`,
        );
        expect(escapeMarkdownText('3. not a list either')).toBe(
            String.raw`3\. not a list either`,
        );
        // A dash, a hash or a number inside a line is just a word.
        expect(escapeMarkdownText('Love - 1. the #1 thing')).toBe(
            'Love - 1. the #1 thing',
        );
    });

    test('one verse is its bold reference and its words, without a number', async () => {
        const bibleItem = genBibleItem(
            { verseStart: 16, verseEnd: 16 },
            'For God so loved the world',
        );
        expect(await genBibleItemQuickTextMarkdown(bibleItem)).toEqual({
            title: '(KJV) John 3:16',
            markdown: '**(KJV) John 3:16**\n\nFor God so loved the world',
        });
        expect(bibleItem.toText).toHaveBeenCalledWith(undefined, 'none');
    });

    test('a range keeps its numbers, and each chapter is a paragraph', async () => {
        const range = genBibleItem(
            { verseStart: 16, verseEnd: 17 },
            '(16): For God (17): For God sent',
        );
        await genBibleItemQuickTextMarkdown(range);
        expect(range.toText).toHaveBeenCalledWith(undefined, 'parenthesis');
        const crossing = genBibleItem(
            { verseStart: 36, verseEnd: 2, chapterEnd: 4 },
            'John 3:36\r\n(36): He that\nJohn 4:1-2\n(1): When (2): Though',
            '(KJV) John 3:36-4:2',
        );
        const { markdown } = await genBibleItemQuickTextMarkdown(crossing);
        expect(crossing.toText).toHaveBeenCalledWith(undefined, 'parenthesis');
        expect(markdown.split('\n\n')).toEqual([
            '**(KJV) John 3:36-4:2**',
            'John 3:36',
            '(36): He that',
            'John 4:1-2',
            '(1): When (2): Though',
        ]);
    });
});

describe("a Bible passage's Create Quick Text", () => {
    test('writes a new, dressed session before it switches to it, then opens the panel', async () => {
        state.settings.set(
            'foreground-quick-text-sessions',
            JSON.stringify([
                { id: '', name: 'Default' },
                { id: 'sold', name: '(KJV) John 3:16' },
            ]),
        );
        mocks.requestForegroundPanelOpening.mockReturnValue(true);
        await openBibleItemInQuickText(
            genBibleItem({ verseStart: 16, verseEnd: 16 }, 'For God *so*'),
        );
        const sessionId = `s${Date.now().toString(36)}`;
        const suffix = `-${sessionId}`;
        expect(
            state.settings.get(`foreground-quick-text-setting${suffix}`),
        ).toBe(
            String.raw`**(KJV) John 3:16**

For God \*so\*`,
        );
        // Dressed by the Bible Verse preset, with time to read it.
        expect(
            state.settings.get(`foreground-quick-text-time-to-live${suffix}`),
        ).toBe('20');
        expect(
            state.settings.get(
                `quick-text${suffix}-setting-show-widget-font-size`,
            ),
        ).toBe('44');
        expect(
            JSON.parse(state.settings.get('foreground-quick-text-sessions')!),
        ).toEqual([
            { id: '', name: 'Default' },
            { id: 'sold', name: '(KJV) John 3:16' },
            { id: sessionId, name: '(KJV) John 3:16 (2)' },
        ]);
        expect(state.settings.get('foreground-quick-text-active-session')).toBe(
            sessionId,
        );
        // The panel reads the session when it switches: words first.
        const order = state.order;
        expect(
            order.indexOf(`foreground-quick-text-setting${suffix}`),
        ).toBeLessThan(order.indexOf('foreground-quick-text-active-session'));
        expect(
            order.indexOf(`quick-text${suffix}-setting-show-widget-decoration`),
        ).toBeLessThan(order.indexOf('foreground-quick-text-active-session'));
        expect(mocks.requestForegroundPanelOpening).toHaveBeenCalledWith(
            'quick-text',
        );
        expect(state.settings.has('foreground-open-panels')).toBe(false);
    });

    test('with no launcher mounted, the panel is opened by its setting', async () => {
        state.settings.set('foreground-open-panels', 'countdown');
        mocks.requestForegroundPanelOpening.mockReturnValue(false);
        await openBibleItemInQuickText(
            genBibleItem({ verseStart: 1, verseEnd: 1 }, 'In the beginning'),
        );
        expect(state.settings.get('foreground-open-panels')).toBe(
            'countdown,quick-text',
        );
    });
});
