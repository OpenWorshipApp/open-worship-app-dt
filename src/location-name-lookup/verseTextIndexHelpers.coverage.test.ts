// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';

// Own mocks: the matcher is pure, but the module pulls the app version and the
// data folder in through `lookupIndexFileHelpers` at import time, and the screen
// flag is read live on every call.
const h = vi.hoisted(() => {
    return { isPageScreen: false };
});

vi.mock('../server/appProvider', () => ({
    default: {
        get isPageScreen() {
            return h.isPageScreen;
        },
        systemUtils: { isDev: false },
        appInfo: { version: '1.0.0' },
        messageUtils: { sendData: () => undefined },
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async () => false,
    fsCreateDir: async () => undefined,
    fsReadFile: async () => null,
    fsWriteFile: async () => '',
    pathJoin: (...paths: string[]) => paths.join('/'),
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorageDirPath: '/tmp/data' },
}));

import {
    decorateLookupMatchesInElement,
    findLookupTextMatches,
    getVerseTextLookupLangCode,
} from './verseTextIndexHelpers';
import { ensureLangPlugins, type LocaleType } from '../lang/langHelpers';
import { findOtherLangPackage } from '../test-setup/langPackageDirs';
import type { LookupTextIndexType } from './verseTextIndexTypes';
import { LOOKUP_TEXT_INDEX_VERSION } from './verseTextIndexTypes';

// Haran is one person AND one city here, so each list holds exactly one
// candidate and only the verse evidence can tell them apart.
function genIndex(): LookupTextIndexType {
    return {
        version: LOOKUP_TEXT_INDEX_VERSION,
        ids: ['id-haran-son', 'id-haran-city', 'id-abram'],
        names: { haran: [0], abram: [2] },
        locations: { haran: [1] },
        verseNames: {
            'GEN 11:31': [0, 2],
            'GEN 12:5': [2],
        },
        verseLocations: {
            'GEN 11:31': [1],
            'GEN 12:5': [1],
        },
    };
}

afterEach(() => {
    h.isPageScreen = false;
    document.body.innerHTML = '';
});

// A language found on disk besides English (none in an English-only checkout).
const otherPackage = findOtherLangPackage();

describe('getVerseTextLookupLangCode on the screen output window', () => {
    test('the screen decorates nothing, whatever the bible', async () => {
        // The languages a window knows once its plugins are read.
        await ensureLangPlugins();
        expect(getVerseTextLookupLangCode('KJV', 'en-US')).toBe('en');
        h.isPageScreen = true;
        expect(getVerseTextLookupLangCode('KJV', 'en-US')).toBeNull();
    });

    test.runIf(otherPackage !== null)(
        'a Bible in another language on disk is decorated off the screen only',
        async () => {
            await ensureLangPlugins();
            const locale = otherPackage!.locale as LocaleType;
            expect(getVerseTextLookupLangCode('XYZ', locale)).toBe(
                otherPackage!.langCode,
            );
            h.isPageScreen = true;
            expect(getVerseTextLookupLangCode('XYZ', locale)).toBeNull();
        },
    );
});

describe('a form the verse attests as a person and a place at once', () => {
    test('stays plain text while the rest of the verse is linked', () => {
        const text = 'Abram went to Haran.';
        expect(findLookupTextMatches(genIndex(), text, 'GEN 11:31')).toEqual([
            {
                start: 0,
                end: 5,
                text: 'Abram',
                kind: 'name',
                recordId: 'id-abram',
            },
        ]);
        // The same words under a verse that attests only the city link it.
        expect(
            findLookupTextMatches(genIndex(), text, 'GEN 12:5').map((match) => {
                return [match.text, match.kind, match.recordId];
            }),
        ).toEqual([
            ['Abram', 'name', 'id-abram'],
            ['Haran', 'location', 'id-haran-city'],
        ]);
    });
});

describe('decorateLookupMatchesInElement', () => {
    function genElement(html: string) {
        const element = document.createElement('div');
        element.innerHTML = html;
        document.body.appendChild(element);
        return element;
    }

    test('splits each matched text node and leaves every character in place', () => {
        const element = genElement(
            '<span class="app-god-word">And Abram went</span> to ' +
                '<b>Haran</b>.<i>  </i>',
        );
        const textBefore = element.textContent;
        const findMatchList = vi.fn((text: string) => {
            return findLookupTextMatches(genIndex(), text, 'GEN 12:5');
        });
        const onActivate = vi.fn();
        decorateLookupMatchesInElement(element, findMatchList, onActivate);
        expect(element.innerHTML).toBe(
            '<span class="app-god-word">And ' +
                '<span class="verse-lookup-link name" title="Abram">Abram</span>' +
                ' went</span> to <b>' +
                '<span class="verse-lookup-link location" title="Haran">' +
                'Haran</span></b>.<i>  </i>',
        );
        expect(element.textContent).toBe(textBefore);
        // The blank node is never offered to the finder; the rest are, in
        // document order.
        expect(
            findMatchList.mock.calls.map((call) => {
                return call[0];
            }),
        ).toEqual(['And Abram went', ' to ', 'Haran', '.']);
        expect(onActivate).not.toHaveBeenCalled();
    });

    test('two matches in one text node keep the text between them', () => {
        const element = genElement('Abram went to Haran.');
        const findMatchList = (text: string) => {
            return findLookupTextMatches(genIndex(), text, 'GEN 12:5');
        };
        decorateLookupMatchesInElement(element, findMatchList, () => {});
        expect(
            Array.from(element.childNodes).map((node) => {
                return node.textContent;
            }),
        ).toEqual(['Abram', ' went to ', 'Haran', '.']);
        expect(
            Array.from(element.querySelectorAll('.verse-lookup-link')).map(
                (link) => {
                    return link.className;
                },
            ),
        ).toEqual(['verse-lookup-link name', 'verse-lookup-link location']);
    });

    test('a click on a link hands its own match to the caller', () => {
        const element = genElement('Abram went to Haran.');
        const onActivate = vi.fn();
        decorateLookupMatchesInElement(
            element,
            (text) => {
                return findLookupTextMatches(genIndex(), text, 'GEN 12:5');
            },
            onActivate,
        );
        const linkList =
            element.querySelectorAll<HTMLElement>('.verse-lookup-link');
        linkList[1].click();
        expect(onActivate).toHaveBeenCalledTimes(1);
        expect(onActivate).toHaveBeenCalledWith(expect.any(MouseEvent), {
            start: 14,
            end: 19,
            text: 'Haran',
            kind: 'location',
            recordId: 'id-haran-city',
        });
    });

    test('decorating twice changes nothing; new content is decorated again', () => {
        const element = genElement('Abram went out.');
        const findMatchList = vi.fn((text: string) => {
            return findLookupTextMatches(genIndex(), text, 'GEN 12:5');
        });
        decorateLookupMatchesInElement(element, findMatchList, () => {});
        const decoratedHtml = element.innerHTML;
        decorateLookupMatchesInElement(element, findMatchList, () => {});
        expect(element.innerHTML).toBe(decoratedHtml);
        expect(findMatchList).toHaveBeenCalledTimes(1);

        // The host re-sets its HTML on a later commit, wiping the links while
        // the element survives: that content must be decorated afresh.
        element.innerHTML = 'Then Haran.';
        decorateLookupMatchesInElement(element, findMatchList, () => {});
        expect(findMatchList).toHaveBeenCalledTimes(2);
        expect(element.innerHTML).toBe(
            'Then <span class="verse-lookup-link location" title="Haran">' +
                'Haran</span>.',
        );
    });

    test('an element with no names is left untouched', () => {
        const element = genElement('In the beginning <em>God</em> created.');
        const findMatchList = vi.fn((text: string) => {
            return findLookupTextMatches(genIndex(), text, 'GEN 1:1');
        });
        decorateLookupMatchesInElement(element, findMatchList, () => {});
        expect(element.innerHTML).toBe(
            'In the beginning <em>God</em> created.',
        );
        expect(findMatchList).toHaveBeenCalledTimes(3);
    });
});
