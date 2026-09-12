/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        installed: [{ key: 'KJV' }, { key: 'KHM' }] as any[],
        lookupKey: 'KJV' as string | null,
        // What each version can read: bibleKey -> reference -> item.
        parseMap: {} as Record<string, Record<string, any>>,
        managers: [] as any[],
        viewData: {} as Record<number, any>,
        presentCalls: [] as any[],
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPagePresenter;
        },
        pathUtils: {
            sep: '\\',
            join: (...parts: string[]) => parts.join('\\'),
            basename: (filePath: string) => {
                return filePath.split(/[\\/]/).pop() ?? '';
            },
            dirname: (filePath: string) => {
                return filePath.replace(/[\\/][^\\/]*$/, '');
            },
        },
        systemUtils: { isDev: false },
    },
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.managers,
}));
vi.mock('../_screen/managers/ScreenBibleManager', () => ({
    default: {
        getInstance: (screenId: number) => ({
            screenViewData: h.viewData[screenId] ?? null,
        }),
        handleBibleItemSelecting: async (event: any, bibleItem: any) => {
            h.presentCalls.push({ event, bibleItem });
            // The manager steps over a locked screen and fills the rest.
            for (const manager of h.managers) {
                if (manager.isSelected && !manager.isLocked) {
                    h.viewData[manager.screenId] = {
                        bibleItemData: {
                            bibleItem,
                            renderedList: [
                                {
                                    bibleKey: bibleItem.bibleKey,
                                    title: bibleItem.title,
                                },
                            ],
                        },
                    };
                }
            }
        },
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromTitleText: async (bibleKey: string, reference: string) => {
            return h.parseMap[bibleKey]?.[reference] ?? null;
        },
    },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    default: class {
        get selectedBibleItem() {
            if (h.lookupKey === null) {
                throw new Error('no lookup');
            }
            return { bibleKey: h.lookupKey };
        }
    },
}));
vi.mock('./bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: async () => h.installed,
}));
vi.mock('./bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: async (_bibleKey: string, bookKey: string) => {
        return bookKey === 'PSA' ? 6 : null;
    },
}));

import { handleAgentBibleRequest } from './agentBibleHelpers';

function genItem(bibleKey: string, title: string, text: string) {
    return {
        bibleKey,
        title,
        target: { bookKey: 'JHN', chapter: 3 } as any,
        toTitle: async () => title,
        toText: async () => text,
    };
}

function genManager(screenId: number, extra: any = {}) {
    return {
        screenId,
        isShowing: false,
        isLocked: false,
        isSelected: true,
        isDeleted: false,
        ...extra,
    };
}

const JOHN = genItem(
    'KJV',
    'John 3:16',
    '(16): For God so loved the world, that he gave his only begotten Son',
);

beforeEach(() => {
    h.isPagePresenter = true;
    h.installed = [{ key: 'KJV' }, { key: 'KHM' }];
    h.lookupKey = 'KJV';
    h.parseMap = { KJV: { 'John 3:16': JOHN } };
    h.managers = [genManager(0)];
    h.viewData = {};
    h.presentCalls = [];
});

describe('handleAgentBibleRequest', () => {
    it('presents a reference and reads the screen back', async () => {
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
        });
        expect(result).toMatchObject({
            isPresented: true,
            reference: 'John 3:16',
            version: 'KJV',
            isAnyShowing: false,
            screens: [
                {
                    screenId: 0,
                    isShowing: false,
                    isLocked: false,
                    bible: { reference: 'John 3:16', version: 'KJV' },
                },
            ],
        });
        expect((result as any).text).toContain('For God so loved');
        expect(h.presentCalls).toHaveLength(1);
        // The same path as the lookup's own "Show bible item": no mouse
        // event, so the ticked screens are the target.
        expect(h.presentCalls[0].event).toBeNull();
        // An off screen holds the verse and shows nothing: said, with the
        // instruction to OFFER the show button rather than press it.
        expect((result as any).note).toContain('OFF');
        expect((result as any).note).toContain('do not press it unasked');
    });

    it('says nothing about an off screen once it is showing', async () => {
        h.managers = [genManager(0, { isShowing: true })];
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
        });
        expect(result).toMatchObject({ isPresented: true, isAnyShowing: true });
        expect((result as any).note).toBeUndefined();
    });

    it('checks a reference without touching a screen', async () => {
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
            action: 'check',
        });
        expect(result).toMatchObject({
            isPresented: false,
            reference: 'John 3:16',
            version: 'KJV',
        });
        expect(h.presentCalls).toHaveLength(0);
        expect((result as any).note).toContain('Nothing was put on a screen');
    });

    it('reads the reference under the lookup version first', async () => {
        h.lookupKey = 'KHM';
        h.parseMap = {
            KJV: { 'John 3:16': JOHN },
            KHM: { 'John 3:16': genItem('KHM', 'យ៉ូហាន 3:16', 'khmer words') },
        };
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
            action: 'check',
        });
        expect(result).toMatchObject({
            version: 'KHM',
            reference: 'យ៉ូហាន 3:16',
        });
    });

    // "John 3:16" does not parse under a Khmer version's book names, and a
    // volunteer who typed it in English wants the verse, not a refusal.
    it('falls through to another installed version when the lookup one cannot read it', async () => {
        h.lookupKey = 'KHM';
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
            action: 'check',
        });
        expect(result).toMatchObject({
            version: 'KJV',
            reference: 'John 3:16',
        });
    });

    it('uses the version asked for and only that one', async () => {
        h.parseMap = {
            KJV: { 'John 3:16': JOHN },
            KHM: { 'John 3:16': genItem('KHM', 'យ៉ូហាន 3:16', 'khmer words') },
        };
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
            version: 'khm',
            action: 'check',
        });
        expect(result).toMatchObject({ version: 'KHM' });
        const missing = await handleAgentBibleRequest({
            reference: 'John 3:16',
            version: 'NIV',
        });
        expect(missing).toMatchObject({
            isError: true,
            versions: ['KJV', 'KHM'],
        });
        expect((missing as any).reason).toContain(
            'No Bible version called "NIV"',
        );
        expect(h.presentCalls).toHaveLength(0);
    });

    it('refuses what no version can read, naming the installed ones', async () => {
        const result = await handleAgentBibleRequest({
            reference: 'Jhn 99:99',
        });
        expect(result).toMatchObject({
            isError: true,
            versions: ['KJV', 'KHM'],
        });
        expect((result as any).reason).toContain(
            '"Jhn 99:99" could not be read as a passage',
        );
        expect(h.presentCalls).toHaveLength(0);
    });

    it('refuses an empty or over-long reference before reading anything', async () => {
        expect(await handleAgentBibleRequest({})).toMatchObject({
            isError: true,
        });
        expect(
            await handleAgentBibleRequest({ reference: 'x'.repeat(81) }),
        ).toMatchObject({ isError: true });
        expect(
            await handleAgentBibleRequest({
                reference: 'John 3:16',
                action: 'x',
            }),
        ).toMatchObject({ isError: true });
    });

    it('refuses off the Presenter page in words for a person', async () => {
        h.isPagePresenter = false;
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
        });
        expect(result).toMatchObject({ isError: true });
        expect((result as any).reason).toContain('Presenter');
        expect((result as any).reason).not.toContain('owa_');
    });

    it('refuses when no version is installed', async () => {
        h.installed = [];
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
        });
        expect((result as any).reason).toContain(
            'No Bible version is installed',
        );
    });

    it('refuses when no screen is ticked, and when every ticked one is locked', async () => {
        h.managers = [genManager(0, { isSelected: false })];
        const none = await handleAgentBibleRequest({ reference: 'John 3:16' });
        expect((none as any).reason).toContain('No screen is chosen');
        h.managers = [genManager(0, { isLocked: true })];
        const locked = await handleAgentBibleRequest({
            reference: 'John 3:16',
        });
        expect((locked as any).reason).toContain('Screen 0 is locked');
        expect(h.presentCalls).toHaveLength(0);
    });

    it('presents on the unlocked screens and names the locked one', async () => {
        h.managers = [genManager(0), genManager(1, { isLocked: true })];
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
        });
        expect(result).toMatchObject({ isPresented: true });
        expect((result as any).screens).toEqual([
            expect.objectContaining({ screenId: 0, bible: expect.any(Object) }),
            expect.objectContaining({
                screenId: 1,
                isLocked: true,
                bible: null,
            }),
        ]);
        expect((result as any).note).toContain('Screen 1 is locked');
    });

    it('steps over a screen the app has deleted', async () => {
        h.managers = [genManager(0), genManager(1, { isDeleted: true })];
        const result = await handleAgentBibleRequest({
            reference: 'John 3:16',
        });
        expect((result as any).screens.map((one: any) => one.screenId)).toEqual(
            [0],
        );
    });

    // "Psalm 23" is how a reading is asked for, and the app's parser only
    // reads a reference with a verse on it: the chapter is read as verse 1
    // to find the book, then widened to every verse it has.
    it('reads a whole chapter as all of its verses', async () => {
        const psalm = genItem(
            'KJV',
            'Psalm 23:1-6',
            '(1): The LORD is my shepherd',
        );
        psalm.target = { bookKey: 'PSA', chapter: 23 };
        const first = genItem(
            'KJV',
            'Psalm 23:1',
            '(1): The LORD is my shepherd',
        );
        first.target = { bookKey: 'PSA', chapter: 23 };
        h.parseMap = {
            KJV: { 'Psalm 23:1': first, 'Psalm 23:1-6': psalm },
        };
        const result = await handleAgentBibleRequest({
            reference: 'Psalm 23',
            action: 'check',
        });
        expect(result).toMatchObject({ reference: 'Psalm 23:1-6' });
        // A book the parser does not know stays refused.
        const refused = await handleAgentBibleRequest({
            reference: 'Psalms 23',
            action: 'check',
        });
        expect(refused).toMatchObject({ isError: true });
    });
});
