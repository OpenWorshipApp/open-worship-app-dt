// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Own mock surface: a reader whose `update` listeners are recorded, bibles that
// know two references, and the real `appHooks` running on plain `useEffect`.
const h = vi.hoisted(() => {
    function genBibleItem(bibleKey: string, target: any) {
        return {
            bibleKey,
            target,
            toTitle: async () => {
                return `${target.bookKey} ${target.chapter} in ${bibleKey}`;
            },
            toText: async () => {
                return `words of ${target.bookKey} in ${bibleKey}`;
            },
        };
    }
    return {
        genBibleItem,
        langCode: 'en',
        controller: null as null | {
            selectedBibleItem: { bibleKey: string };
            registerEventListener: (
                eventList: string[],
                listener: () => void,
            ) => string;
            unregisterEventListener: (token: string) => void;
        },
        registeredList: [] as { eventList: string[]; token: string }[],
        unregisteredList: [] as string[],
        listenerList: [] as (() => void)[],
        sectionList: null as any[] | null,
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../helper/loggerHelpers', () => ({ appWarning: () => undefined }));
vi.mock('../helper/errorHelpers', () => ({ handleError: () => undefined }));
vi.mock('../bible-list/BibleItem', () => ({
    default: {
        fromVerseKey: async (bibleKey: string, verseKey: string) => {
            if (verseKey === 'EZK 27:11') {
                return h.genBibleItem(bibleKey, {
                    bookKey: 'EZK',
                    chapter: 27,
                    verseStart: 11,
                    verseEnd: 11,
                });
            }
            if (verseKey === 'JHN 18:33-19:2') {
                return h.genBibleItem(bibleKey, {
                    bookKey: 'JHN',
                    chapter: 18,
                    verseStart: 33,
                    verseEnd: 2,
                    chapterEnd: 19,
                });
            }
            return null;
        },
        fromTitleText: async (bibleKey: string, text: string) => {
            if (text === 'Ezekiel 27:11') {
                return h.genBibleItem(bibleKey, {
                    bookKey: 'EZK',
                    chapter: 27,
                    verseStart: 11,
                    verseEnd: 11,
                });
            }
            return null;
        },
    },
}));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        toTextSectionList: async () => {
            return h.sectionList;
        },
        toLocaleBook: async (_bibleKey: string, bookKey: string) => {
            return `book ${bookKey}`;
        },
    },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    getCurrentLookupBibleItemController: () => {
        return h.controller;
    },
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    // A bible with no numeral list for the chapter answers null.
    toLocaleNumBible: async (bibleKey: string, n: number) => {
        return bibleKey === 'NONUM' ? null : `${n}`;
    },
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: async (bibleKey: string) => {
        return `font of ${bibleKey}`;
    },
}));
vi.mock('../helper/helpers', () => ({
    cloneJson: (value: any) => JSON.parse(JSON.stringify(value)),
}));
vi.mock('../lang/langHelpers', () => ({ DEFAULT_LANG_CODE: 'en' }));
vi.mock('./lookupLangHelpers', () => ({
    getSelectedLookupLangCode: () => h.langCode,
    useLookupLangCode: () => h.langCode,
}));

import {
    getLookupVerseBibleKey,
    shortToReferenceTitle,
    shortToVerseCopyData,
    shortToVerseData,
    shortToVerseSectionList,
    shortToVerseTitle,
    useLookupVerseBibleKey,
    useLookupVerseFontFamily,
} from './bibleVerseHelpers';

function mountReader(bibleKey: string) {
    h.controller = {
        selectedBibleItem: { bibleKey },
        registerEventListener: (eventList, listener) => {
            const token = `events-${h.registeredList.length + 1}`;
            h.registeredList.push({ eventList, token });
            h.listenerList.push(listener);
            return token;
        },
        unregisterEventListener: (token) => {
            h.unregisteredList.push(token);
        },
    };
    return h.controller;
}

beforeEach(() => {
    h.langCode = 'en';
    h.controller = null;
    h.registeredList = [];
    h.unregisteredList = [];
    h.listenerList = [];
    h.sectionList = null;
});

describe('getLookupVerseBibleKey', () => {
    test('names the reader bible only outside English', () => {
        expect(getLookupVerseBibleKey('xx')).toBe('KJV');
        mountReader('XXV');
        expect(getLookupVerseBibleKey('xx')).toBe('XXV');
        expect(getLookupVerseBibleKey()).toBe('KJV');
        h.langCode = 'xx';
        expect(getLookupVerseBibleKey()).toBe('XXV');
    });
});

describe('the hooks a detail panel reads its bible through', () => {
    let container: HTMLDivElement;
    let root: Root;

    function BibleKeyHostComp(_props: Readonly<{ revision: number }>) {
        const bibleKey = useLookupVerseBibleKey();
        return <span>{bibleKey}</span>;
    }

    function FontHostComp({
        fixedBibleKey,
    }: Readonly<{ fixedBibleKey?: string }>) {
        const fontFamily = useLookupVerseFontFamily(fixedBibleKey);
        return <span>{fontFamily ?? 'no font yet'}</span>;
    }

    async function flush() {
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('follows the reader on its update event and lets go on unmount', () => {
        h.langCode = 'xx';
        const reader = mountReader('XXV');
        act(() => {
            root.render(<BibleKeyHostComp revision={1} />);
        });
        expect(container.textContent).toBe('XXV');
        expect(h.registeredList).toEqual([
            { eventList: ['update'], token: 'events-1' },
        ]);

        reader.selectedBibleItem.bibleKey = 'XXS';
        act(() => {
            h.listenerList[0]();
        });
        expect(container.textContent).toBe('XXS');

        // English pins the KJV again, and the listener is swapped, not added.
        h.langCode = 'en';
        act(() => {
            root.render(<BibleKeyHostComp revision={2} />);
        });
        expect(container.textContent).toBe('KJV');
        expect(h.unregisteredList).toEqual(['events-1']);
        expect(h.registeredList).toHaveLength(2);

        act(() => {
            root.unmount();
        });
        expect(h.unregisteredList).toEqual(['events-1', 'events-2']);
        root = createRoot(container);
    });

    test('with no reader mounted it answers the KJV and listens to nothing', () => {
        h.langCode = 'xx';
        act(() => {
            root.render(<BibleKeyHostComp revision={1} />);
        });
        expect(container.textContent).toBe('KJV');
        expect(h.registeredList).toEqual([]);
    });

    test('the font is the bible font, a fixed bible winning over the lookup one', async () => {
        h.langCode = 'xx';
        mountReader('XXV');
        act(() => {
            root.render(<FontHostComp />);
        });
        expect(container.textContent).toBe('no font yet');
        await flush();
        expect(container.textContent).toBe('font of XXV');

        act(() => {
            root.render(<FontHostComp fixedBibleKey="NIV" />);
        });
        await flush();
        expect(container.textContent).toBe('font of NIV');
    });
});

describe('reading a reference the bible cannot resolve', () => {
    test('every reader gives back null', async () => {
        expect(await shortToVerseData('KJV', 'NOPE 1:1')).toBeNull();
        expect(await shortToVerseSectionList('KJV', 'NOPE 1:1', 1)).toBeNull();
        expect(await shortToVerseCopyData('KJV', 'NOPE 1:1')).toBeNull();
        expect(await shortToVerseTitle('KJV', 'NOPE 1:1')).toBeNull();
    });

    test('the lenient parser still finds a title-shaped reference', async () => {
        expect(await shortToVerseTitle('KJV', 'Ezekiel 27:11')).toBe(
            'EZK 27 in KJV',
        );
    });
});

describe('verse data for a panel', () => {
    test('a one-chapter verse is read as plain text in its bible font', async () => {
        expect(await shortToVerseData('XXV', 'EZK 27:11')).toEqual({
            bibleKey: 'XXV',
            title: 'EZK 27 in XXV',
            text: 'words of EZK in XXV',
            style: { fontFamily: 'font of XXV' },
            sectionList: null,
            chapterCount: 1,
            shownChapterCount: 1,
        });
    });

    test('a passage whose chapters cannot be read shows no sections', async () => {
        expect(await shortToVerseData('KJV', 'JHN 18:33-19:2')).toMatchObject({
            text: '',
            sectionList: [],
            chapterCount: 2,
            shownChapterCount: 2,
        });
        // Copy has nothing to copy rather than an empty passage.
        expect(await shortToVerseCopyData('KJV', 'JHN 18:33-19:2')).toBeNull();
    });
});

describe('naming a chapter in a bible with no numeral for it', () => {
    test('gives back null so the shipped label is kept', async () => {
        expect(await shortToReferenceTitle('KJV', 'chapter', 'GEN 14')).toBe(
            'book GEN 14',
        );
        expect(
            await shortToReferenceTitle('NONUM', 'chapter', 'GEN 14'),
        ).toBeNull();
    });
});
