import { describe, expect, it } from 'vitest';

import { PRESENTER_DEMO_LIST } from '../../tools/owa-devtools-mcp/presenterDemos.mjs';
import { READER_DEMO_LIST } from '../../tools/owa-devtools-mcp/readerDemos.mjs';
import { PAGE_DEMO_LIST } from '../../tools/owa-devtools-mcp/pageDemos.mjs';
import {
    listAssistantLangPackages,
    listLangPackageCodes,
    readLangPackageDictionary,
} from '../test-setup/langPackageDirs';

const CATALOG_TEXT = [
    'Search tips',
    'No tips found',
    'Getting started',
    'Reading and layout',
    'Notes and marks',
    'Reader shortcuts',
    'File menu',
    'Edit menu',
    'View menu',
    'Tools menu',
    'Window menu',
    'Help menu',
    'Study tools',
    ...PRESENTER_DEMO_LIST.flatMap(({ label, detail }) => [label, detail]),
    ...READER_DEMO_LIST.flatMap(({ label, detail }) => [label, detail]),
    ...PAGE_DEMO_LIST.flatMap(({ label, detail }) => [label, detail]),
];

// Every language package but English, read from its `dictionary.json` the
// way `tran()` looks a label up. It used to look for each package's
// `index.ts`, which no package has had since languages became plugins, so
// it found none and checked nothing: on 2026-11-12 a Reader tip's detail was
// reworded with no string in any language, and every translated Reader
// threw on load in dev (`getReaderTips` translates every tip as it mounts).
const LANG_CODE_LIST = listLangPackageCodes({ isEnglishIncluded: false });

// The packages written by hand, the ones the assistant is written for (an
// `assistant.json`). Only there is a string equal to its English a tip left
// untranslated: a machine-translated one may rightly keep a loanword --
// Filipino's "Slide Editor".
const HAND_MADE_SET = new Set(
    listAssistantLangPackages().map(({ langCode }) => {
        return langCode;
    }),
);

function toLookupKey(text: string) {
    return text.trim().toLowerCase();
}

type DemoStepType = {
    find?: string | null;
    finds?: string[];
    translateFind?: boolean | string;
    translateFinds?: boolean;
};

// The words a tip hands to `tran()` for the control it presses, read the way
// each catalog reads them: the Presenter's `getPresenterDemo` translates a
// find whole -- a scoped one is a key of its own, its panel's English widget
// name kept -- and the Reader's `getReaderDemo` part by part. A find with no
// key throws in a translated dev window as a missing label does; in a
// packaged one it stays English and lands on nothing. On 2026-11-15 the path
// editor's two Presenter tips went back to translated finds with no
// `Background > Show path editor` key, and only a live Khmer run saw it.
function listPresenterFindKeys() {
    return PRESENTER_DEMO_LIST.flatMap(({ steps }) => {
        return (steps as DemoStepType[]).flatMap((step) => {
            const keyList: string[] = [];
            if (step.translateFind && typeof step.find === 'string') {
                keyList.push(step.find);
            }
            if (step.translateFinds === true) {
                keyList.push(
                    ...(step.finds ??
                        (typeof step.find === 'string' ? [step.find] : [])),
                );
            }
            return keyList;
        });
    });
}

function listReaderFindKeys() {
    return READER_DEMO_LIST.flatMap(({ steps }) => {
        return (steps as DemoStepType[]).flatMap((step) => {
            const findList: string[] = [];
            if (step.translateFind) {
                const key =
                    step.translateFind === true
                        ? step.find
                        : step.translateFind;
                if (typeof key === 'string') {
                    findList.push(key);
                }
            }
            if (step.translateFinds === true) {
                findList.push(
                    ...(step.finds ??
                        (typeof step.find === 'string' ? [step.find] : [])),
                );
            }
            return findList.flatMap((find) => find.split(' > '));
        });
    });
}

const FIND_KEY_LIST = [
    ...new Set([...listPresenterFindKeys(), ...listReaderFindKeys()]),
];

describe('tip translations in every language package', () => {
    // None when only English is in the checkout, and the suite still runs.
    it('reads the packages there are, so a green run means something', () => {
        for (const langCode of LANG_CODE_LIST) {
            expect(
                Object.keys(readLangPackageDictionary(langCode)).length,
                langCode,
            ).toBeGreaterThan(1000);
        }
    });
});

describe.each(LANG_CODE_LIST)('%s tip translations', (langCode) => {
    it('translates every title, description, category and search label', () => {
        const dictionary = readLangPackageDictionary(langCode);
        const missingList = CATALOG_TEXT.filter((text) => {
            const value = dictionary[toLookupKey(text)];
            return typeof value !== 'string' || value.trim().length === 0;
        });
        expect(missingList).toEqual([]);
        if (!HAND_MADE_SET.has(langCode)) {
            return;
        }
        const englishList = CATALOG_TEXT.filter((text) => {
            return dictionary[toLookupKey(text)] === text;
        });
        expect(englishList).toEqual([]);
    });

    it('has a key for every control a tip finds by its translated words', () => {
        const dictionary = readLangPackageDictionary(langCode);
        const missingList = FIND_KEY_LIST.filter((key) => {
            const value = dictionary[toLookupKey(key)];
            return typeof value !== 'string' || value.trim().length === 0;
        });
        expect(missingList).toEqual([]);
    });
});
